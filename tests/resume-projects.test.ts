import { expect, test } from "bun:test";
import {
  enrichResumeProjects,
  localResumeProjects,
  projectFromFacts,
  resumeURLs,
  attachResumeRepositories,
} from "../src/lib/resume-projects";
import { mergeProjects } from "../src/lib/project-merge";
import { parseProjectPage } from "../src/lib/project-import";
const text = `Alex Builder
Projects
Notes · TypeScript, React Jan 2026
• A local notes app with offline search
that works without a network connection
• Supports shared notebooks.
https://notes.example.com/
Orbits · Rust Feb 2026
• A simulator with replayable events.
Honors & Community
Top hacker 2026
https://devfolio.co/projects/notes-1234
https://github.com/alex-builder/orbits
https://linkedin.com/in/alex-builder
https://alex-builder.com/`;
test("named résumé projects keep descriptions, stacks and associated links without importing awards", () => {
  const facts = localResumeProjects(text);
  expect(facts.map((p) => p.name)).toEqual(["Notes", "Orbits"]);
  expect(facts[0].description).toContain("offline search");
  expect(facts[0].stack).toBe("TypeScript, React");
  expect(facts[0].links).toEqual(["https://notes.example.com/"]);
  expect(facts[1].links).toEqual(["https://github.com/alex-builder/orbits"]);
});
test("model-generated URLs must come from the résumé and ownership stays unanswered", () => {
  const p = projectFromFacts(
    {
      name: "Notes",
      description: "Offline notes.",
      stack: "React",
      links: ["https://invented.example.com", "https://notes.example.com/"],
    },
    resumeURLs(text),
  );
  expect(p.url).toBe("https://notes.example.com/");
  expect(p.websiteUrl).toBe(p.url);
  expect(p.buildMode).toBe("");
  expect(p.githubUrl).toBe("");
});
test("page enrichment finds repository and website, merges duplicate showcase links, and retains failed project facts", async () => {
  const result = await enrichResumeProjects(text, localResumeProjects(text), {
    importer: async (url) => {
      if (url.includes("orbits")) throw new Error("unavailable");
      return {
        project: {
          name: "Notes",
          url,
          platform: "Devfolio",
          description: "Public page context.",
          stack: "JavaScript",
          githubUrl: "https://github.com/alex-builder/notes",
          websiteUrl: "https://notes.example.com/",
        },
        githubCandidates: ["https://github.com/alex-builder/notes"],
        warnings: [],
        checkedAt: "2026-10-11T00:00:00.000Z",
      };
    },
  });
  expect(result.projects).toHaveLength(2);
  expect(result.projects[0].githubUrl).toBe(
    "https://github.com/alex-builder/notes",
  );
  expect(result.projects[0].description).toContain("offline search");
  expect(result.projects[0].stack).toBe("TypeScript, React");
  expect(result.projects[1].description).toContain("replayable");
  expect(result.warnings.some((w) => w.includes("Orbits"))).toBe(true);
});
test("repeat imports fill missing links while keeping user edits and team attribution", () => {
  const p = projectFromFacts(
    {
      name: "Notes",
      description: "User edited description",
      stack: "React",
      links: [],
    },
    [],
  );
  p.buildMode = "team";
  p.contribution = "I built the editor.";
  const incoming = {
    ...p,
    id: "other",
    description: "Extracted description",
    githubUrl: "https://github.com/alex/notes",
    buildMode: "" as const,
    contribution: "",
  };
  const merged = mergeProjects([p], [incoming, incoming]);
  expect(merged).toHaveLength(1);
  expect(merged[0].id).toBe(p.id);
  expect(merged[0].description).toBe("User edited description");
  expect(merged[0].buildMode).toBe("team");
  expect(merged[0].contribution).toBe("I built the editor.");
  expect(merged[0].githubUrl).toBe(incoming.githubUrl);
});
test("live website discovery excludes footer/social links and leaves ambiguous demo links unset", () => {
  const html = `<main><h1>Notes</h1><a href="https://notes.example.com">Live website</a><a href="https://github.com/alex/notes">Source</a><a href="https://x.com/alex">Website on X</a></main><footer><a href="https://platform.example.com">Website</a></footer>`;
  expect(
    parseProjectPage(html, "https://devfolio.co/projects/notes").project
      .websiteUrl,
  ).toBe("https://notes.example.com/");
  expect(
    parseProjectPage(
      html.replace(
        "</main>",
        '<a href="https://other.example.com">Demo</a></main>',
      ),
      "https://devfolio.co/projects/notes",
    ).project.websiteUrl,
  ).toBe("");
});

test("repository discovery uses the supplied account and ignores forks or unrelated accounts", async () => {
  const projects = localResumeProjects(text).map((p) =>
    projectFromFacts({ ...p, links: [] }, []),
  );
  const result = await attachResumeRepositories(projects, {
    githubUsername: "alex-builder",
    listRepos: async () => [
      {
        name: "Notes",
        html_url: "https://github.com/alex-builder/notes",
        fork: false,
      },
      {
        name: "Orbits",
        html_url: "https://github.com/other/orbits",
        fork: false,
      },
      {
        name: "Orbits",
        html_url: "https://github.com/alex-builder/orbits",
        fork: true,
      },
    ],
    importer: async (url) => ({
      project: {
        name: "Notes",
        platform: "GitHub",
        url,
        description: "Public context",
        stack: "TypeScript",
        githubUrl: url,
      },
      githubCandidates: [url],
      warnings: [],
      checkedAt: "2026-10-11T00:00:00.000Z",
    }),
  });
  expect(result[0].githubUrl).toBe("https://github.com/alex-builder/notes");
  expect(result[0].description).toContain("offline search");
  expect(result[1].githubUrl).toBe("");
  expect(result[0].buildMode).toBe("");
});
