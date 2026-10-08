import { expect, test } from "bun:test";
import { isEmployerExcluded } from "../src/lib/employer-exclusions";
import { applyDiscovery } from "../src/lib/job-discovery";
import { initialWorkspace, type DiscoverySource } from "../src/lib/model";
import { testEmployerExclusion, testJob } from "./fixtures/workspace";
const exclusions = [testEmployerExclusion];

test("employer exclusions recognize names, publisher aliases, and owned domains", () => {
  for (const name of ["Hire Feed", "HireFeed", "HIRE-FEED", "hirefeedd"])
    expect(isEmployerExcluded(name, "", exclusions)).toBe(true);
  for (const url of [
    "https://www.linkedin.com/company/hirefeedd/life/",
    "https://gh.linkedin.com/jobs/view/full-stack-developer-typescript-python-rust-go-remote-at-hire-feed-4436724655",
    "https://www.hirefeed.co.in/",
    "https://jobs.hirefeed.co.in/role/1",
  ])
    expect(isEmployerExcluded("", url, exclusions)).toBe(true);
});

test("mentioning a feed does not exclude a distinct employer or a similar domain", () => {
  for (const [name, url] of [
    ["Acme", "https://acme.example/jobs/1?ref=hirefeed"],
    ["Not HireFeed", "https://nothirefeed.co.in/"],
    ["HireFeed Tools", "https://hirefeed.co.in.evil.example/"],
    ["Acme", "https://linkedin.com/company/acme/"],
  ])
    expect(isEmployerExcluded(name, url, exclusions)).toBe(false);
  expect(isEmployerExcluded("HireFeed", "", [])).toBe(false);
  expect(
    isEmployerExcluded("", "", [
      {
        ...testEmployerExclusion,
        key: "",
        name: "",
        aliases: [""],
        domains: [""],
      },
    ]),
  ).toBe(false);
});

test("persistence guard blocks reimport with a new listing ID and preserves archived application history", () => {
  const workspace = initialWorkspace();
  workspace.employerExclusions = exclusions;
  workspace.jobs = [
    {
      ...testJob,
      company: "Hire Feed",
      stage: "Archived",
      notes: "My saved notes",
      followUp: "2026-10-20",
    },
  ];
  const source: DiscoverySource = {
    source: "LinkedIn",
    status: "complete",
    query: "TypeScript",
    checked: 1,
    matched: 1,
    imported: 0,
    checkedAt: new Date().toISOString(),
    message: "Live",
  };
  applyDiscovery(workspace, {
    jobs: [
      {
        ...testJob,
        id: "new-feed-role",
        company: "HireFeed",
        source: "LinkedIn",
        url: "https://linkedin.com/jobs/view/new-role-999",
      },
    ],
    sources: [source],
    checkedAt: source.checkedAt,
  });
  expect(workspace.jobs).toHaveLength(1);
  expect(workspace.jobs[0].stage).toBe("Archived");
  expect(workspace.jobs[0].notes).toBe("My saved notes");
  expect(workspace.jobs[0].followUp).toBe("2026-10-20");
  expect(source.imported).toBe(0);
});
