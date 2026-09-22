import { expect, test } from "bun:test";
import { parseResume } from "../src/lib/resume";
import {
  localResumeProjects,
  mergeResumeFacts,
} from "../src/lib/resume-projects";
import { extractResumeDetails } from "../src/lib/resume-details";
const first = `Alex Builder\nDeveloper\nSkills: Elixir, Phoenix, Gleam\nFeatured Projects:\nAurora | Elixir\n• A collaborative editor.\nhttps://github.com/alex/aurora\nhttps://aurora.example.com\nEducation\nUniversity`;
const second = `Sam Designer\nDesigner\nSkills: Swift, SwiftUI\nSide Projects\nCanvas | Swift\n• A drawing app.\nhttps://github.com/sam/canvas\nAwards\nDesign award`;
const importer = async () => {
  throw new Error("Site unavailable");
};
test("inline skill sections retain technologies outside any predefined list", () => {
  expect(parseResume(first).fields.skills).toBe("Elixir, Phoenix, Gleam");
  expect(parseResume(second).fields.skills).toBe("Swift, SwiftUI");
  expect(localResumeProjects(first)[0].name).toBe("Aurora");
});
test("Claude facts cannot drop local projects or introduce URLs absent from the document", () => {
  const facts = mergeResumeFacts(
    localResumeProjects(first),
    [
      {
        name: "Aurora",
        description: "Editor",
        stack: "",
        links: ["https://invented.example.com"],
      },
    ],
    first,
  );
  expect(facts).toHaveLength(1);
  expect(facts[0].links).toEqual([
    "https://github.com/alex/aurora",
    "https://aurora.example.com/",
  ]);
});
test("sequential uploads extract independent identities and retain project facts when a website fails", async () => {
  const options = {
    useAI: false,
    signal: AbortSignal.timeout(1000),
    onProgress: () => {},
    importer,
  };
  const a = await extractResumeDetails(first, options);
  const b = await extractResumeDetails(second, options);
  expect(a.fields.name).toBe("Alex Builder");
  expect(b.fields.name).toBe("Sam Designer");
  expect(a.projects.map((project) => project.name)).toEqual(["Aurora"]);
  expect(b.projects.map((project) => project.name)).toEqual(["Canvas"]);
  expect(b.projectLinks).not.toContain("https://github.com/alex/aurora");
  expect(a.warnings.some((warning) => warning.includes("Aurora"))).toBe(true);
});
test("AI outage is explicit and local extraction remains reviewable", async () => {
  const result = await extractResumeDetails(first, {
    useAI: true,
    apiKey: "test-key",
    signal: AbortSignal.timeout(2000),
    onProgress: () => {},
    importer,
    aiFetch: (async () =>
      Response.json(
        { error: { type: "overloaded_error", message: "unavailable" } },
        { status: 503 },
      )) as unknown as typeof fetch,
  });
  expect(result.mode).toBe("Local extraction");
  expect(result.projects[0].name).toBe("Aurora");
  expect(
    result.warnings.some((warning) =>
      warning.includes("Claude could not complete"),
    ),
  ).toBe(true);
});
