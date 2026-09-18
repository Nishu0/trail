import type { Company, Job, EmployerExclusion } from "../../src/lib/model";
export const testEmployerExclusion: EmployerExclusion = {
  key: "hirefeed",
  name: "Hire Feed",
  aliases: ["HireFeed", "hirefeedd"],
  domains: ["hirefeed.co.in"],
  reason: "Job aggregator/feed; excluded from employer recommendations.",
  sourceUrl: "https://www.linkedin.com/company/hirefeedd/",
};
export const testCompany: Company = {
  id: "test-company",
  name: "Example team",
  category: "Developer tools",
  description: "Tools for builders",
  website: "https://example.com",
  repo: "",
  color: "#eef1e9",
  initials: "E",
  notes: "",
  people: [],
};
export const testJob: Job = {
  id: "real-1",
  company: "Example team",
  role: "Product engineer",
  source: "YC",
  url: "https://example.com/jobs/1",
  description: "Product engineering in TypeScript and React",
  location: "Remote",
  tags: ["TypeScript", "React"],
  stage: "Saved",
  notes: "",
  sample: false,
  addedAt: "2026-10-11T00:00:00.000Z",
};
