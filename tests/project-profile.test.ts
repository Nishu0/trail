import { expect, test } from "bun:test";
import { parseProjectPage } from "../src/lib/project-import";
import { findDevfolioProfile } from "../src/lib/project-profile";
import { projectSchema } from "../src/lib/validation";

test("project saves require a name and a personal contribution for team projects", () => {
  const project = {
    id: "notes",
    name: "Notes",
    platform: "Personal",
    url: "",
    description: "Notes app",
    stack: "React",
    buildMode: "team",
  };
  expect(projectSchema.safeParse(project).success).toBe(false);
  expect(
    projectSchema.safeParse({ ...project, contribution: "I built the editor." })
      .success,
  ).toBe(true);
  expect(
    projectSchema.safeParse({ ...project, buildMode: "solo" }).success,
  ).toBe(true);
  expect(
    projectSchema.safeParse({ ...project, buildMode: "", name: " " }).success,
  ).toBe(false);
});

test("Devfolio contributor links identify the person without selecting an arbitrary teammate", async () => {
  const result = parseProjectPage(
    `<html><head><title>Notes | Devfolio</title></head><body><nav><a href="/@OTHER">Alex Builder</a></nav><main>
    <h1>Notes</h1><a href="/@ALex02">AlexBuilder</a><a href="https://devfolio.co/@SAM">Sam Builder</a>
    <a href="https://devfolio.co.evil.example/@BAD">Alex Builder</a><a href="/@ALex02?tab=projects">AlexBuilder</a>
    </main></body></html>`,
    "https://devfolio.co/projects/notes-1234",
  );
  expect(result.devfolioProfiles).toEqual([
    { name: "AlexBuilder", url: "https://devfolio.co/@ALex02" },
    { name: "Sam Builder", url: "https://devfolio.co/@SAM" },
  ]);
  expect(
    await findDevfolioProfile(result.devfolioProfiles!, {
      name: "Alex Builder",
    }),
  ).toBe("https://devfolio.co/@ALex02");
  expect(
    await findDevfolioProfile(result.devfolioProfiles!, {
      name: "Someone Else",
    }),
  ).toBe("");
});

test("a linked GitHub account resolves ambiguous names, while multiple matches stay unset", async () => {
  const candidates = [
    { name: "Alex", url: "https://devfolio.co/@alex-one" },
    { name: "Alex", url: "https://devfolio.co/@alex-two" },
  ];
  expect(
    await findDevfolioProfile(
      candidates,
      { github: "alex-builder" },
      {
        readPage: async (url) =>
          `<a href="https://github.com/${url.endsWith("one") ? "other" : "alex-builder"}">GitHub</a>`,
      },
    ),
  ).toBe("https://devfolio.co/@alex-two");
  expect(
    await findDevfolioProfile(
      candidates,
      { github: "alex-builder" },
      {
        readPage: async () =>
          `<a href="https://github.com/alex-builder">GitHub</a>`,
      },
    ),
  ).toBe("");
  expect(
    await findDevfolioProfile(
      candidates,
      { github: "alex-builder" },
      {
        readPage: async () => {
          throw new Error("unavailable");
        },
      },
    ),
  ).toBe("");
});

test("ETHGlobal remains a project source and is never extracted as a personal profile", async () => {
  const { parseResume } = await import("../src/lib/resume");
  const parsed = parseResume(
    "Alex Builder\nEngineer\nhttps://ethglobal.com/showcase/notes-1234\nhttps://ethglobal.com/events/online",
  );
  expect("ethglobal" in parsed.fields).toBe(false);
  expect(parsed.projectLinks).toContain(
    "https://ethglobal.com/showcase/notes-1234",
  );
});
