import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { parseResume, resumeText, checkDocxSize } from "../src/lib/resume";
import {
  parseProjectPage,
  projectURL,
  privateAddress,
  githubRepository,
} from "../src/lib/project-import";
import { normalizeResults, relevantXProfiles } from "../src/lib/company-search";
import { projectStory } from "../src/lib/model";
import { profileSchema } from "../src/lib/validation";
import { emptyProfile } from "../src/lib/model";
const resume = `Alex Builder\nProduct engineer\nLocation: Ahmedabad, India\nhttps://github.com/alex-builder\nSummary\nI build developer tools and shipped a local-first notes app.\nTechnical skills\nTypeScript, React, Next.js, Solidity\nProjects\nhttps://ethglobal.com/showcase/example-123\nhttps://github.com/alex-builder/notes`;
describe("résumé import", () => {
  test("finds only supplied profile facts and separates project links from profile links", () => {
    const result = parseResume(resume);
    expect(result.fields.name).toBe("Alex Builder");
    expect(result.fields.headline).toBe("Product engineer");
    expect(result.fields.location).toBe("Ahmedabad, India");
    expect(result.fields.github).toBe("alex-builder");
    expect(result.fields.skills).toContain("Solidity");
    expect(result.fields.bio).toContain("local-first");
    expect("ethglobal" in result.fields).toBe(false);
    expect(result.projectLinks).toEqual([
      "https://ethglobal.com/showcase/example-123",
      "https://github.com/alex-builder/notes",
    ]);
  });
  test("text files work and binary or mislabeled files are rejected", async () => {
    expect(await resumeText(Buffer.from(resume), "resume.txt")).toBe(resume);
    await expect(
      resumeText(Buffer.from("not a pdf"), "resume.pdf"),
    ).rejects.toThrow("contents");
    await expect(
      resumeText(Buffer.from([0, 1, 2]), "resume.txt"),
    ).rejects.toThrow();
  });
  test("real PDF and DOCX extraction preserve résumé facts", async () => {
    for (const extension of ["pdf", "docx"]) {
      const text = await resumeText(
        await readFile(
          new URL(`./fixtures/resume.${extension}`, import.meta.url),
        ),
        `resume.${extension}`,
      );
      expect(parseResume(text).fields.name).toBe("Alex Builder");
      expect(parseResume(text).fields.skills).toContain("TypeScript");
      expect(parseResume(text).projectLinks).toContain(
        "https://github.com/alex-builder/notes",
      );
    }
  });
  test("DOCX decompression is bounded", () => {
    const zipDirectory = Buffer.alloc(50);
    zipDirectory.writeUInt32LE(0x02014b50, 0);
    zipDirectory.writeUInt32LE(20 * 1024 * 1024, 24);
    expect(() => checkDocxSize(zipDirectory)).toThrow("too large");
  });
});
describe("project context and attribution", () => {
  test("finds linked repositories in page content and Next data without collecting footer links", () => {
    const html = `<html><head><meta property="og:title" content="Notes | ETHGlobal"><meta property="og:description" content="An offline-first shared notebook."></head><body><main><header><h1>Notes</h1></header><header><a href="https://github.com/alex/notes/tree/main">Source</a></header><p>A project built at a hackathon.</p></main><footer><a href="https://github.com/platform/website">Platform</a></footer><script id="__NEXT_DATA__" type="application/json">{"source":"https:\\/\\/github.com\\/alex\\/notes"}</script></body></html>`;
    const result = parseProjectPage(
      html,
      "https://ethglobal.com/showcase/notes",
    );
    expect(result.project.name).toBe("Notes");
    expect(result.project.platform).toBe("ETHGlobal");
    expect(result.githubCandidates).toEqual(["https://github.com/alex/notes"]);
    expect(result.project.description).toContain("offline-first");
    expect(result.project).not.toHaveProperty("buildMode");
  });
  test("private network targets and unsafe URLs are blocked while public addresses work", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "169.254.169.254",
      "192.168.1.1",
      "::1",
      "fc00::1",
      "::ffff:127.0.0.1",
    ])
      expect(privateAddress(address)).toBe(true);
    for (const address of ["8.8.8.8", "104.26.0.150", "2606:4700:20::681a:96"])
      expect(privateAddress(address)).toBe(false);
    for (const url of [
      "http://example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://user:password@example.com",
      "https://example.com:444/",
    ])
      expect(() => projectURL(url)).toThrow();
    expect(projectURL("https://devfolio.co/projects/notes").hostname).toBe(
      "devfolio.co",
    );
    expect(githubRepository("https://github.com/login/oauth")).toBe("");
  });
  test("team descriptions cannot become claims of sole ownership", () => {
    const project = {
      id: "1",
      name: "Notes",
      url: "",
      description: "A shared notes app.",
      platform: "ETHGlobal",
      stack: "TypeScript",
      buildMode: "team" as const,
      contribution: "I built the frontend. My teammates wrote the contracts.",
    };
    expect(projectStory(project)).toContain("I worked with a team");
    expect(projectStory(project)).toContain("I built the frontend.");
    expect(projectStory({ ...project, buildMode: "" })).not.toContain(
      "I built",
    );
    expect(projectStory({ ...project, contribution: "" })).toContain(
      "[Add what you personally contributed.]",
    );
    expect(
      profileSchema.parse({
        ...emptyProfile,
        projects: [project],
        resume: {
          name: "resume.txt",
          text: resume,
          uploadedAt: new Date().toISOString(),
        },
      }).projects[0].contribution,
    ).toBe(project.contribution);
  });
});
describe("company research evidence", () => {
  test("unrelated X surnames are excluded and the company account is not a person", () => {
    const candidates = normalizeResults("x-users", {
      users: [
        {
          name: "Turso",
          url: "https://x.com/tursodatabase",
          description: "Database tools",
        },
        {
          name: "Drew Turso",
          url: "https://x.com/drew",
          description: "I like sports",
        },
        {
          name: "Alex",
          url: "https://x.com/alex",
          description: "Engineer at Turso",
        },
      ],
    });
    const results = relevantXProfiles(candidates, "Turso", "Turso");
    expect(results.map((r) => r.title)).toEqual(["Turso", "Alex"]);
    expect(results[0].kind).toBe("company");
    expect(results[1].kind).toBe("person");
  });
  test("X users and posts normalize with sources and no invented affiliation", () => {
    const users = normalizeResults("x-users", {
      users: [
        {
          name: "Turso",
          screen_name: "tursodatabase",
          url: "https://x.com/tursodatabase",
          description: "Database tools",
        },
      ],
    });
    expect(users[0].summary).toBe("Database tools");
    expect(users[0]).not.toHaveProperty("role");
    const posts = normalizeResults("x-posts", {
      posts: [
        {
          url: "https://x.com/builder/status/123",
          author: { name: "Alex" },
          text: "We are hiring",
        },
      ],
    });
    expect(posts[0].title).toBe("Alex");
    expect(posts[0].kind).toBe("post");
  });
  test("LinkedIn results are limited to public profile URLs", () => {
    const result = normalizeResults("linkedin", {
      web: {
        results: [
          {
            title: "Alex",
            url: "https://www.linkedin.com/in/alex",
            description: "Profile excerpt",
          },
          { title: "Fake", url: "https://linkedin.com.evil.test/in/alex" },
          { title: "Jobs", url: "https://www.linkedin.com/jobs" },
        ],
      },
    });
    expect(result.length).toBe(1);
    expect(result[0].summary).toBe("Profile excerpt");
  });
  test("Exa excerpts retain evidence and reject script links", () => {
    const result = normalizeResults("exa-people", {
      results: [
        {
          title: "Alex",
          url: "https://example.com/team",
          highlights: ["Founder at Acme"],
        },
        { title: "Unsafe", url: "javascript:alert(1)" },
      ],
    });
    expect(result.length).toBe(1);
    expect(result[0].summary).toBe("Founder at Acme");
  });
});
