import { expect, test } from "bun:test";
import {
  discoveryTerms,
  matchingTerms,
  xCandidates,
  linkedinCandidates,
  explicitLinkedInJob,
  extractHiringCandidates,
  findOpportunities,
} from "../src/lib/job-finder";
import { RESUME_MODEL } from "../src/lib/resume-ai";
import { testJob, testEmployerExclusion } from "./fixtures/workspace";
const linkedin = {
  url: "https://www.linkedin.com/jobs/view/engineer-at-acme-123",
  title: "Acme hiring Rust Engineer in Remote | LinkedIn",
  text: "Acme is hiring a Rust Engineer. Remote.",
  source: "LinkedIn" as const,
};
const x = {
  url: "https://x.com/builder/status/123",
  title: "Hiring post",
  text: "Acme is hiring a Rust Engineer. Remote.",
  source: "X" as const,
};
test("skill matching uses word boundaries rather than matching Go inside unrelated words", () => {
  expect(matchingTerms("Our goal is a Django app", ["Go", "Rust"])).toEqual([]);
  expect(
    matchingTerms("NextJS, ReactJS and Rust", ["React", "Next.js", "Rust"]),
  ).toHaveLength(3);
  expect(
    discoveryTerms({ skills: "Rust, Rust, Go", target: "Product engineer" }),
  ).toEqual(["Rust", "Go", "Product engineer"]);
});
test("X discovery excludes job seekers, generic advice and unrelated posts", () => {
  const posts = [
    x,
    {
      ...x,
      url: "https://x.com/b/status/124",
      text: "Rust advice: ship small projects",
    },
    {
      ...x,
      url: "https://x.com/c/status/125",
      text: "Looking for a job in Rust. Hiring anyone?",
    },
    {
      ...x,
      url: "https://x.com/d/status/126",
      text: "Acme hiring Java engineer",
    },
  ];
  expect(xCandidates({ posts }, ["Rust"]).map((item) => item.url)).toEqual([
    x.url,
  ]);
});
test("LinkedIn discovery accepts public job pages, not employee profiles or search pages", () => {
  const candidates = linkedinCandidates({
    web: {
      results: [
        { ...linkedin, description: "Rust <b>Engineer</b>" },
        { ...linkedin, url: "https://linkedin.com/in/alex" },
        { ...linkedin, url: "https://linkedin.com/jobs/search/" },
        { ...linkedin, url: "https://evil.example/jobs/view/fake" },
      ],
    },
  });
  expect(candidates).toHaveLength(1);
  expect(candidates[0].text).toBe("Rust Engineer");
  const job = explicitLinkedInJob(candidates[0], ["Rust"]);
  expect(job?.company).toBe("Acme");
  expect(job?.role).toBe("Rust Engineer");
  expect(job?.location).toBe("Remote");
});
test("hiring extraction rejects hallucinated companies, roles, author affiliations and source URLs", async () => {
  const facts = [
    {
      url: x.url,
      company: "Acme",
      role: "Rust Engineer",
      location: "Remote",
      companyEvidence: "Acme",
      roleEvidence: "Rust Engineer",
    },
    {
      url: x.url,
      company: "Builder",
      role: "Rust Engineer",
      location: "",
      companyEvidence: "Acme",
      roleEvidence: "Rust Engineer",
    },
    {
      url: x.url,
      company: "Acme",
      role: "CEO",
      location: "",
      companyEvidence: "Acme",
      roleEvidence: "Rust Engineer",
    },
    {
      url: "https://x.com/fake/status/777",
      company: "Acme",
      role: "Rust Engineer",
      location: "",
      companyEvidence: "Acme",
      roleEvidence: "Rust Engineer",
    },
  ];
  const mockFetch = (async () =>
    Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: RESUME_MODEL,
      content: [{ type: "text", text: JSON.stringify({ jobs: facts }) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 40 },
    })) as unknown as typeof fetch;
  const extracted = await extractHiringCandidates([x], ["Rust"], {
    apiKey: "test-only-key",
    fetch: mockFetch,
  });
  expect(extracted.jobs).toHaveLength(1);
  expect(extracted.jobs[0].company).toBe("Acme");
  expect(extracted.jobs[0].role).toBe("Rust Engineer");
});
test("missing AI access keeps explicitly named LinkedIn roles and omits ambiguous X employers", async () => {
  const result = await extractHiringCandidates([linkedin, x], ["Rust"]);
  expect(result.jobs.map((job) => job.source)).toEqual(["LinkedIn"]);
  expect(result.omitted).toBe(1);
});
test("exclusions apply to both explicit LinkedIn employers and verified AI-extracted hiring posts", async () => {
  const feed = {
    ...linkedin,
    url: "https://gh.linkedin.com/jobs/view/rust-engineer-at-hire-feed-4436724655",
    title: "Hire Feed hiring Rust Engineer in Remote | LinkedIn",
  };
  const explicit = await extractHiringCandidates([feed, linkedin], ["Rust"], {
    excludedEmployers: [testEmployerExclusion],
  });
  expect(explicit.jobs.map((job) => job.company)).toEqual(["Acme"]);
  const post = { ...x, text: "HireFeed is hiring a Rust Engineer. Remote." };
  const mockFetch = (async () =>
    Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: RESUME_MODEL,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            jobs: [
              {
                url: post.url,
                company: "HireFeed",
                role: "Rust Engineer",
                location: "Remote",
                companyEvidence: "HireFeed",
                roleEvidence: "Rust Engineer",
              },
            ],
          }),
        },
      ],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 40 },
    })) as unknown as typeof fetch;
  const extracted = await extractHiringCandidates([post], ["Rust"], {
    excludedEmployers: [testEmployerExclusion],
    apiKey: "test-only-key",
    fetch: mockFetch,
  });
  expect(extracted.jobs).toEqual([]);
});

test("all three discovery sources omit excluded employers before returning matches", async () => {
  const blocked = { ...testJob, company: "Hire Feed", tags: ["Rust"] };
  const result = await findOpportunities(
    { skills: "Rust", target: "" },
    {
      excludedEmployers: [testEmployerExclusion],
      yc: async () => [blocked],
      search: async () => ({ candidates: [linkedin], checked: 1 }),
      extract: async () => ({
        jobs: [{ ...blocked, source: "LinkedIn" }],
        omitted: 0,
        note: "",
      }),
    },
  );
  expect(result.jobs).toEqual([]);
  expect(
    result.sources.every(
      (source) => source.matched === 0 && source.status === "complete",
    ),
  ).toBe(true);
});
test("three-source discovery runs independently and preserves good results when one source fails", async () => {
  const calls: string[] = [];
  const result = await findOpportunities(
    { skills: "Rust", target: "" },
    {
      yc: async () => {
        calls.push("YC");
        return [{ ...testJob, description: "Rust", tags: ["Rust"] }];
      },
      search: async (source) => {
        calls.push(source);
        if (source === "X") throw new Error("X rate limited");
        return { candidates: [linkedin], checked: 3 };
      },
      extract: async (candidates) => ({
        jobs: candidates.map((candidate) =>
          explicitLinkedInJob(candidate, ["Rust"])!,
        ),
        omitted: 0,
        note: "",
      }),
    },
  );
  expect(calls.sort()).toEqual(["LinkedIn", "X", "YC"]);
  expect(
    result.sources.map((source) => [source.source, source.status]),
  ).toEqual([
    ["YC", "complete"],
    ["X", "unavailable"],
    ["LinkedIn", "complete"],
  ]);
  expect(result.jobs).toHaveLength(2);
  expect(result.sources[2].checked).toBe(3);
  expect(result.sources[1].message).toBe("X rate limited");
});

test("ambiguous language names cannot match ordinary move/go marketing copy", () => {
  expect(
    matchingTerms("Deel is hiring. Know your next move. Go for it!", [
      "Move",
      "Go",
    ]),
  ).toEqual([]);
  expect(
    matchingTerms("Hiring Go engineers and Move developers", ["Move", "Go"]),
  ).toEqual(["Move", "Go"]);
  expect(matchingTerms("A Golang developer", ["Go"])).toEqual(["Go"]);
});

test("repeat discovery refreshes public facts without duplicating or overwriting application edits", async () => {
  const { applyDiscovery } = await import("../src/lib/job-discovery");
  const { initialWorkspace } = await import("../src/lib/model");
  const workspace = initialWorkspace();
  const job = {
    ...testJob,
    id: "yc-live",
    stage: "Applied" as const,
    notes: "My research",
    followUp: "2026-10-20",
  };
  workspace.jobs = [job];
  const sources = [
    {
      source: "YC" as const,
      status: "complete" as const,
      query: "Rust",
      checked: 20,
      matched: 1,
      imported: 0,
      checkedAt: new Date().toISOString(),
      message: "Live",
    },
  ];
  applyDiscovery(workspace, {
    jobs: [
      {
        ...job,
        description: "Updated listing",
        stage: "Saved",
        notes: "Automated note",
        followUp: undefined,
      },
    ],
    sources,
    checkedAt: sources[0].checkedAt,
  });
  expect(workspace.jobs).toHaveLength(1);
  expect(workspace.jobs[0].description).toBe("Updated listing");
  expect(workspace.jobs[0].notes).toBe("My research");
  expect(workspace.jobs[0].stage).toBe("Applied");
  expect(workspace.jobs[0].followUp).toBe("2026-10-20");
  expect(sources[0].imported).toBe(0);
});

test("company website lookup excludes similarly named employers", async () => {
  const { companyWebsiteCandidates } =
    await import("../src/lib/company-search");
  const base = {
    url: "https://example.com",
    summary: "",
    provider: "Exa",
    kind: "company" as const,
  };
  const candidates = companyWebsiteCandidates(
    [
      { ...base, title: "MAI Labs" },
      {
        ...base,
        title: "Medical Artificial Intelligence Laboratory (MAI Lab)",
      },
      { ...base, title: "MAIA LABS" },
      { ...base, title: "Other", summary: "Official site for MAI Labs" },
    ],
    "MAI Labs",
  );
  expect(candidates.map((candidate) => candidate.title)).toEqual([
    "MAI Labs",
    "Other",
  ]);
});
