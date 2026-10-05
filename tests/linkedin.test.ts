import { expect, test, beforeAll, afterAll } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";
import { createWorkspaceRepository } from "../src/db/workspace-repository";
import { createLinkedInRepository } from "../src/db/linkedin-repository";
import {
  linkedinProfileUrl,
  validateTuningRevisions,
  tuneLinkedIn,
  refreshPublicProfile,
} from "../src/lib/linkedin-tuning";
import { wordChanges } from "../src/lib/linkedin-diff";
const postgres = new PGlite();
const db = drizzle(postgres, { schema });
beforeAll(async () => await migrate(db, { migrationsFolder: "./drizzle" }));
afterAll(async () => await postgres.close());
async function repository() {
  const id = crypto.randomUUID();
  await createWorkspaceRepository(db, id).getWorkspace();
  return createLinkedInRepository(db, id);
}
const section = {
  id: "qiro",
  label: "Qiro · Experience",
  kind: "experience" as const,
  company: "Qiro",
  title: "Software Engineer",
  dates: "",
  currentText: "Built Move contracts.",
  facts:
    "Built Move contracts. Co-led the full-stack marketplace with one coworker. Integrated Ritual infrastructure.",
};
test("profile links are canonical and do not accept company pages or arbitrary URLs", () => {
  expect(linkedinProfileUrl("https://linkedin.com/in/Nishu0?view=x")).toBe(
    "https://www.linkedin.com/in/Nishu0",
  );
  expect(() =>
    linkedinProfileUrl("https://linkedin.com/company/qiro"),
  ).toThrow();
  expect(() => linkedinProfileUrl("https://example.com/in/x")).toThrow();
});
test("current text, evidence, chat and revisions round-trip and publishing is version-safe", async () => {
  const repo = await repository();
  await repo.saveUrl("https://www.linkedin.com/in/example");
  await repo.saveSection(section);
  await repo.addMessage("user", "Make the contribution clearer.", section.id);
  await repo.addAssistant(
    "A clearer draft.",
    [
      {
        sectionId: section.id,
        baseVersion: 1,
        beforeText: section.currentText,
        afterText: "Built Move contracts and co-led marketplace delivery.",
        rationale: "Preserve team ownership.",
        supportingFacts: ["Built Move contracts."],
        missingMetrics: ["How many pools?"],
      },
    ],
    section.id,
  );
  let state = await repo.getState();
  expect(state.messages).toHaveLength(2);
  expect(state.sections[0].facts).toContain("coworker");
  const revision = state.messages[1].revisions[0];
  await repo.confirmRevision(revision.id);
  state = await repo.getState();
  expect(state.sections[0].currentText).toBe(revision.afterText);
  expect(state.sections[0].source).toBe("user_confirmed");
  expect(state.messages[1].revisions[0].status).toBe("published");
  await expect(repo.confirmRevision(revision.id)).rejects.toThrow("already");
  await repo.addAssistant(
    "Second draft.",
    [
      {
        sectionId: section.id,
        baseVersion: state.sections[0].version,
        beforeText: state.sections[0].currentText,
        afterText: "A later draft",
        rationale: "",
        supportingFacts: ["Built Move contracts."],
        missingMetrics: [],
      },
    ],
    section.id,
  );
  const later = (await repo.getState()).messages.at(-1)!.revisions[0];
  await repo.saveSection(
    { ...section, currentText: "My manually updated text" },
    state.sections[0].version,
  );
  await expect(repo.confirmRevision(later.id)).rejects.toThrow("changed");
  expect((await repo.getState()).sections[0].currentText).toBe(
    "My manually updated text",
  );
});
test("public refresh does not overwrite current sections and workspace boundaries isolate revisions", async () => {
  const a = await repository(),
    b = await repository();
  await a.saveUrl("https://www.linkedin.com/in/example");
  await a.saveSection(section);
  await a.saveSync(
    "https://www.linkedin.com/in/example",
    "unavailable",
    "",
    "Login page",
  );
  expect((await a.getState()).sections[0].currentText).toBe(
    section.currentText,
  );
  expect((await b.getState()).sections).toHaveLength(0);
  await expect(b.confirmRevision(crypto.randomUUID())).rejects.toThrow(
    "not found",
  );
  await expect(a.saveSection(section, 99)).rejects.toThrow("changed");
});
test("invented metrics, peer evidence and changes to another section are withheld", async () => {
  const repo = await repository();
  await repo.saveSection(section);
  const state = await repo.getState();
  const proposal = {
    sectionId: section.id,
    afterText: "Built Move contracts.",
    rationale: "",
    supportingFacts: ["Built Move contracts."],
    missingMetrics: [],
  };
  expect(
    validateTuningRevisions(
      { reply: "", revisions: [proposal] },
      state,
      "",
      section.id,
    ).revisions,
  ).toHaveLength(1);
  expect(
    validateTuningRevisions(
      {
        reply: "",
        revisions: [
          { ...proposal, afterText: "Processed $10M in investments." },
        ],
      },
      state,
      "",
      section.id,
    ).revisions,
  ).toHaveLength(0);
  expect(
    validateTuningRevisions(
      {
        reply: "",
        revisions: [
          { ...proposal, supportingFacts: ["Borrowed a peer's claim"] },
        ],
      },
      state,
      "",
      section.id,
    ).revisions,
  ).toHaveLength(0);
  expect(
    validateTuningRevisions(
      { reply: "", revisions: [proposal] },
      state,
      "",
      "other",
    ).revisions,
  ).toHaveLength(0);
});
test("diffs preserve original and replacement text, including an empty baseline", () => {
  const before = "Built Move contracts.",
    after = "Co-led Move contracts and UI.";
  const diff = wordChanges(before, after);
  expect(
    diff
      .filter((p) => p.kind !== "added")
      .map((p) => p.text)
      .join(""),
  ).toBe(before);
  expect(
    diff
      .filter((p) => p.kind !== "removed")
      .map((p) => p.text)
      .join(""),
  ).toBe(after);
  expect(wordChanges("", after)).toEqual([{ kind: "added", text: after }]);
});
test("Claude revisions use user evidence and benchmark lessons without treating peers as user accomplishments", async () => {
  const repo = await repository();
  await repo.saveSection(section);
  const state = await repo.getState();
  let body: any;
  const mockFetch = (async (_url: unknown, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-haiku-5-5",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            reply: "Clearer ownership.",
            revisions: [
              {
                sectionId: "qiro",
                afterText:
                  "Built Move contracts and co-led full-stack delivery.",
                rationale: "Make collaboration clear.",
                supportingFacts: ["Built Move contracts."],
                missingMetrics: ["What was the verified usage?"],
              },
            ],
          }),
        },
      ],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 40 },
    });
  }) as unknown as typeof fetch;
  const result = await tuneLinkedIn(state, "Draft this", "qiro", [], {
    apiKey: "test-key",
    fetch: mockFetch,
  });
  expect(result.revisions).toHaveLength(1);
  expect(body.model).toBe("claude-haiku-5-5");
  expect(body.output_config.format.type).toBe("json_schema");
});
test("LinkedIn sign-in pages cannot masquerade as successful profile refreshes", async () => {
  const before = process.env.EXA_API_KEY;
  process.env.EXA_API_KEY = "test-only";
  try {
    const mockFetch = (async () =>
      Response.json({
        results: [
          {
            url: "https://www.linkedin.com/in/example",
            text: "Join LinkedIn. Sign in to see this profile.",
          },
        ],
      })) as unknown as typeof fetch;
    const result = await refreshPublicProfile(
      "https://linkedin.com/in/example",
      { fetch: mockFetch },
    );
    expect(result.status).toBe("unavailable");
    expect(result.text).toBe("");
  } finally {
    if (before === undefined) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = before;
  }
});

test("changing facts invalidates a prior revision even when current text is unchanged", async () => {
  const repo = await repository();
  await repo.saveSection(section);
  await repo.addAssistant(
    "Draft",
    [
      {
        sectionId: section.id,
        baseVersion: 1,
        beforeText: section.currentText,
        afterText: "Updated text",
        rationale: "",
        supportingFacts: ["Built Move contracts."],
        missingMetrics: [],
      },
    ],
    section.id,
  );
  const revision = (await repo.getState()).messages[0].revisions[0];
  await repo.saveSection({ ...section, facts: "New facts" }, 1);
  await expect(repo.confirmRevision(revision.id)).rejects.toThrow("changed");
});
test("research library stores one row per unique profile and never marks an incomplete corpus complete", async () => {
  const repo = await repository();
  const reviews = Array.from({ length: 100 }, (_, i) => ({
    name: `Synthetic QA ${i}`,
    url: `https://www.linkedin.com/in/qa-${i}`,
    cohort: "Test fixture",
    query: "test",
    checkedAt: new Date().toISOString(),
    summary: "Synthetic test description",
    takeaway: "Specific systems",
    evidence: "Test fixture quote",
    signals: ["specific-system"],
    caution: "Test only",
  }));
  await expect(
    repo.saveResearch(reviews.slice(0, 99), [], "Test fixture"),
  ).rejects.toThrow("100");
  await repo.saveResearch(reviews, [], "Test fixture");
  expect((await repo.getResearch()).profiles).toHaveLength(100);
  expect((await repo.getState()).research?.reviewedCount).toBe(100);
});
test("numbered bullet markers do not become invented KPI claims", async () => {
  const repo = await repository();
  await repo.saveSection(section);
  const state = await repo.getState();
  expect(
    validateTuningRevisions(
      {
        reply: "",
        revisions: [
          {
            sectionId: section.id,
            afterText:
              "1. Built Move contracts.\n2. Co-led full-stack development.",
            rationale: "",
            supportingFacts: ["Built Move contracts."],
            missingMetrics: [],
          },
        ],
      },
      state,
      "",
      section.id,
    ).revisions,
  ).toHaveLength(1);
});
