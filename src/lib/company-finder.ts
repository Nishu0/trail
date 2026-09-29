import type { Profile, Job, EmployerExclusion } from "./model";
import { isEmployerExcluded } from "./employer-exclusions";
import { fetchYCJobs } from "./yc-jobs";
import { searchCompany, type ResearchCandidate } from "./company-search";
export type CompanyLead = {
  name: string;
  url: string;
  description: string;
  provider: string;
  reasons: string[];
  jobs: { title: string; url: string; location: string }[];
};
export type CompanyFinding = {
  companies: CompanyLead[];
  query: string;
  checkedAt: string;
  sources: { name: string; checked: number; error?: string }[];
};
export function companyKeywords(query: string) {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[,\n;]|\s+(?:and|or)\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}
export function ycCompanyLeads(jobs: Job[], keywords: string[]): CompanyLead[] {
  const companies = new Map<string, CompanyLead>();
  for (const job of jobs) {
    const reasons = keywords.filter((term) =>
      `${job.company} ${job.role} ${job.description} ${job.tags.join(" ")}`
        .toLowerCase()
        .includes(term),
    );
    if (!reasons.length) continue;
    const source = new URL(job.url);
    const path = /^\/companies\/([^/]+)/.exec(source.pathname);
    if (!path || source.hostname !== "www.ycombinator.com") continue;
    const url = `${source.origin}/companies/${path[1]}`;
    const entry = companies.get(url) || {
      name: job.company,
      url,
      description: job.description,
      provider: "YC · current job index",
      reasons: [],
      jobs: [],
    };
    entry.reasons = [...new Set([...entry.reasons, ...reasons])];
    if (!entry.jobs.some((item) => item.url === job.url))
      entry.jobs.push({
        title: job.role,
        url: job.url,
        location: job.location,
      });
    companies.set(url, entry);
  }
  return [...companies.values()]
    .sort((a, b) => b.reasons.length - a.reasons.length)
    .slice(0, 16);
}
export async function findCompanies(
  profile: Pick<Profile, "target" | "skills">,
  query: string,
  options: {
    signal?: AbortSignal;
    exa?: boolean;
    yc?: typeof fetchYCJobs;
    search?: (query: string) => Promise<ResearchCandidate[]>;
    excludedEmployers?: EmployerExclusion[];
  } = {},
): Promise<CompanyFinding> {
  const terms =
    query.trim() || [profile.target, profile.skills].filter(Boolean).join(", ");
  if (!terms)
    throw new Error(
      "Add your skills or target roles in Your story, or enter a company focus here.",
    );
  const keywords = companyKeywords(terms);
  const sources: CompanyFinding["sources"] = [];
  const companies: CompanyLead[] = [];
  const tasks = [
    (async () => {
      try {
        const jobs = await (options.yc || fetchYCJobs)(options.signal);
        companies.push(...ycCompanyLeads(jobs, keywords));
        sources.push({ name: "YC", checked: jobs.length });
      } catch {
        sources.push({
          name: "YC",
          checked: 0,
          error: "YC’s live index could not be read. Try again shortly.",
        });
      }
    })(),
  ];
  if (options.exa ?? !!process.env.EXA_API_KEY)
    tasks.push(
      (async () => {
        try {
          const search =
            options.search ||
            (async (q: string) =>
              (
                await searchCompany("exa-company", q, "", {
                  fresh: true,
                  signal: options.signal,
                })
              ).results);
          const results = await search(
            `Startup companies building ${terms.slice(0, 500)}. Find company websites, not articles or directories.`,
          );
          companies.push(
            ...results.map((result) => ({
              name: result.title,
              url: result.url,
              description: result.summary,
              provider: "Exa · company search",
              reasons: keywords.filter((term) =>
                `${result.title} ${result.summary}`
                  .toLowerCase()
                  .includes(term),
              ),
              jobs: [],
            })),
          );
          sources.push({ name: "Exa", checked: results.length });
        } catch {
          sources.push({
            name: "Exa",
            checked: 0,
            error:
              "Exa search could not complete. Check provider access or try again.",
          });
        }
      })(),
    );
  await Promise.all(tasks);
  options.signal?.throwIfAborted();
  if (sources.every((source) => source.error))
    throw new Error(sources.map((source) => source.error).join(" "));
  // Deduplicate canonical company pages; never manufacture a result if sources are empty.
  const unique = new Map<string, CompanyLead>();
  for (const lead of companies) {
    if (isEmployerExcluded(lead.name, lead.url, options.excludedEmployers))
      continue;
    const url = new URL(lead.url);
    const key =
      url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "");
    if (!unique.has(key)) unique.set(key, lead);
  }
  return {
    companies: [...unique.values()].slice(0, 24),
    query: terms,
    checkedAt: new Date().toISOString(),
    sources,
  };
}
