import { expect, test } from "bun:test";
import { findCompanies, ycCompanyLeads } from "../src/lib/company-finder";
import { parseCompanyWebsite } from "../src/lib/company-import";
import { testJob, testEmployerExclusion } from "./fixtures/workspace";
const rustJob = {
  ...testJob,
  company: "A database team",
  role: "Rust engineer",
  url: "https://www.ycombinator.com/companies/database-team/jobs/1",
  description: "A database",
  tags: ["Rust"],
};
const reactJob = {
  ...testJob,
  company: "A design team",
  role: "React engineer",
  url: "https://www.ycombinator.com/companies/design-team/jobs/2",
  tags: ["React"],
};
test("live YC company leads use matching listings and combine roles from the same source company", () => {
  const leads = ycCompanyLeads(
    [
      rustJob,
      {
        ...rustJob,
        role: "Database engineer",
        url: "https://www.ycombinator.com/companies/database-team/jobs/3",
      },
      reactJob,
    ],
    ["rust"],
  );
  expect(leads).toHaveLength(1);
  expect(leads[0].url).toBe(
    "https://www.ycombinator.com/companies/database-team",
  );
  expect(leads[0].jobs).toHaveLength(2);
  expect(leads[0].reasons).toEqual(["rust"]);
});
test("each discovery uses current profile context and empty live results stay empty", async () => {
  const yc = async () => [rustJob, reactJob];
  const first = await findCompanies({ target: "", skills: "Rust" }, "", {
    exa: false,
    yc,
  });
  const second = await findCompanies({ target: "", skills: "React" }, "", {
    exa: false,
    yc,
  });
  expect(first.companies[0].name).toBe("A database team");
  expect(second.companies[0].name).toBe("A design team");
  const empty = await findCompanies({ target: "", skills: "Elixir" }, "", {
    exa: false,
    yc,
  });
  expect(empty.companies).toEqual([]);
});
test("partial provider failures retain source evidence; total failures do not fabricate companies", async () => {
  const search = async () => [
    {
      title: "Actual source",
      url: "https://example.com",
      summary: "Rust database",
      provider: "Exa",
      kind: "company" as const,
    },
  ];
  const yc = async () => {
    throw new Error("upstream down");
  };
  const result = await findCompanies({ target: "", skills: "Rust" }, "", {
    exa: true,
    yc,
    search,
  });
  expect(result.companies).toHaveLength(1);
  expect(
    result.sources.find((source) => source.name === "YC")?.error,
  ).toBeDefined();
  await expect(
    findCompanies({ target: "", skills: "Rust" }, "", { exa: false, yc }),
  ).rejects.toThrow("live index");
});
test("company website import uses live metadata and linked repositories without inferring employees", () => {
  const { company } = parseCompanyWebsite(
    `<title>Database Team | Home</title><script type="application/ld+json">{"@type":"Organization","name":"Database Team","description":"An engine written in Rust","sameAs":["https://linkedin.com/company/database-team"]}</script><a href="https://github.com/database-team/engine">Source</a>`,
    "https://example.com",
  );
  expect(company.name).toBe("Database Team");
  expect(company.repo).toBe("database-team/engine");
  expect(company.notes).toContain("https://linkedin.com/company/database-team");
  expect(company.notes).toContain("Research source: https://example.com");
  expect(company.people).toEqual([]);
});
test("company discovery excludes blocked feed names, LinkedIn aliases and domains without removing actual employers", async () => {
  const result = await findCompanies({ target: "", skills: "Rust" }, "", {
    excludedEmployers: [testEmployerExclusion],
    exa: true,
    yc: async () => [{ ...rustJob, company: "Hire Feed" }],
    search: async () =>
      [
        { title: "HireFeed", url: "https://example.com/feed" },
        {
          title: "Hire Feed | LinkedIn",
          url: "https://linkedin.com/company/hirefeedd/life/",
        },
        { title: "An AI-curated job feed", url: "https://hirefeed.co.in/" },
        { title: "A real company", url: "https://real.example/" },
      ].map((result) => ({
        ...result,
        summary: "Rust",
        provider: "Exa",
        kind: "company" as const,
      })),
  });
  expect(result.companies.map((company) => company.name)).toEqual([
    "A real company",
  ]);
});
