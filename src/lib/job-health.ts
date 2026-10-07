import { load } from "cheerio";
import type { Job, JobHealth, Workspace } from "./model";
import { fetchPublicResource, type PublicResource } from "./public-resource";
import { brandLink, findWebsiteBrand } from "./company-brand";
import { boundedBytes } from "./import-utils";
import { companyWebsiteCandidates, searchCompany } from "./company-search";
import { parseCompanyWebsite } from "./company-import";

export type JobInspection = {
  id: string;
  originalUrl: string;
  health: JobHealth;
  logoUrl?: string;
  logoSource?: string;
  companyWebsite?: string;
};
export function inspectJobPage(
  job: Job,
  page: PublicResource,
  now = new Date(),
): JobInspection {
  const result: JobInspection = {
    id: job.id,
    originalUrl: job.url,
    health: {
      status: "unverified",
      url: page.url,
      checkedAt: now.toISOString(),
      reason: "The public page does not confirm whether applications are open.",
    },
  };
  const set = (
    status: JobHealth["status"],
    reason: string,
    evidence?: string,
  ) => {
    Object.assign(result.health, {
      status,
      reason,
      ...(evidence ? { evidence: evidence.slice(0, 300) } : {}),
    });
    return result;
  };
  if (
    /\/(?:login|signin|signup|authwall|checkpoint)(?:\/|$)/i.test(
      new URL(page.url).pathname,
    )
  )
    return set(
      "unavailable",
      "The source redirected to sign-in or an access check.",
    );
  if ([404, 410].includes(page.status))
    return set(
      "closed",
      "The original job page has been removed.",
      `HTTP ${page.status}`,
    );
  if (page.status !== 200)
    return set(
      "unavailable",
      `The source could not be checked (HTTP ${page.status}).`,
    );
  const $ = load(page.body.toString("utf8"));
  $("script, style, nav, footer").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  if (
    /captcha|verify you are human|access denied|just a moment|enable javascript|sign in to (?:view|continue)|join linkedin|sign up to linkedin/i.test(
      text,
    )
  )
    return set(
      "unavailable",
      "The source requires sign-in or blocked this public check.",
    );
  const closed =
    /(?:this (?:job|role|position|opening) (?:is|has been) (?:closed|filled|removed|no longer available)|(?:job|position|opening) no longer (?:available|accepting applications)|no longer accepting applications|this job has expired|job posting has expired)/i.exec(
      text,
    );
  // Only a listing-specific closure signal is enough to archive. Generic footer text is ignored.
  if (closed)
    return set(
      "closed",
      "The listing says it is no longer accepting applications.",
      closed[0],
    );
  const postings: Record<string, unknown>[] = [];
  const raw = load(page.body.toString("utf8"));
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (String(o["@type"]).includes("JobPosting")) postings.push(o);
    if (o["@graph"]) visit(o["@graph"]);
  };
  raw('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse(raw(el).text()));
    } catch {}
  });
  const normalize = (s: unknown) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const posting =
    postings.find(
      (p) => p.url === job.url || normalize(p.title) === normalize(job.role),
    ) ||
    (postings.length === 1 &&
    new URL(page.url).pathname === new URL(job.url).pathname
      ? postings[0]
      : undefined);
  if (posting) {
    const organization = posting.hiringOrganization as
      Record<string, unknown> | undefined;
    if (organization) {
      result.logoUrl = brandLink(organization.logo, page.url) || undefined;
      if (result.logoUrl) result.logoSource = page.url;
      result.companyWebsite =
        brandLink(organization.sameAs || organization.url, page.url) ||
        undefined;
    }
    const expires =
      typeof posting.validThrough === "string"
        ? Date.parse(posting.validThrough)
        : NaN;
    if (Number.isFinite(expires) && expires < now.getTime())
      return set(
        "closed",
        "The listing’s published application deadline has passed.",
        String(posting.validThrough),
      );
    if (posting.title && /apply|application/i.test(text))
      return set("open", "A job listing and application action are present.");
  }
  if (new URL(page.url).hostname === "www.ycombinator.com") {
    try {
      const props = JSON.parse(
        raw("[data-page]").attr("data-page") || "{}",
      ).props;
      const company =
        props?.company || props?.job?.company || props?.jobPosting?.company;
      if (company) {
        result.companyWebsite =
          brandLink(company.website, page.url) || undefined;
        result.logoUrl =
          brandLink(
            company.logo_url || company.logoUrl || company.small_logo_url,
            page.url,
          ) || undefined;
        if (result.logoUrl) result.logoSource = page.url;
      }
      const p = props?.job || props?.jobPosting || props?.job_posting;
      if (
        p &&
        (p.is_active === false || p.active === false || p.status === "closed")
      )
        return set(
          "closed",
          "YC marks this listing as closed.",
          "Inactive YC job listing",
        );
    } catch {
      /* public page format changed */
    }
    if (
      /\/companies\/[^/]+\/jobs\/[^/]+/.test(new URL(page.url).pathname) &&
      /apply (?:to|for)|apply now/i.test(text)
    )
      return set(
        "open",
        "YC still shows this role with an application action.",
      );
  }
  if (/log in|sign in/.test(text) && text.length < 700)
    return set(
      "unavailable",
      "The source requires sign-in for this public check.",
    );
  return result;
}
export async function checkJob(
  job: Job,
  signal?: AbortSignal,
): Promise<JobInspection> {
  try {
    if (
      job.source === "X" &&
      /^(?:www\.)?(?:x|twitter)\.com$/.test(new URL(job.url).hostname)
    )
      return await checkXJob(job, signal);
    const page = await fetchPublicResource(job.url, signal);
    const inspection = inspectJobPage(job, page);
    const website = inspection.companyWebsite || job.companyWebsite;
    if (!inspection.logoUrl && !job.logoUrl && website)
      Object.assign(inspection, await findWebsiteBrand(website, signal));
    return inspection;
  } catch {
    return {
      id: job.id,
      originalUrl: job.url,
      health: {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
        url: job.url,
        reason: "This source could not be reached. It will be checked again.",
      },
    };
  }
}
export function applicationLinkInPost(text: string) {
  const links = [...text.matchAll(/https:\/\/[^\s<>]+/g)]
    .map((m) => m[0].replace(/[),.;]+$/, ""))
    .filter(
      (link) =>
        !/^(www\.)?(x\.com|twitter\.com|pbs\.twimg\.com)$/.test(
          new URL(link).hostname,
        ),
    );
  const explicitlyLabeled =
    /(?:apply(?: here)?|application(?: link)?|job link|careers?)\s*[:→-]?\s*(https:\/\/[^\s<>]+)/i.exec(
      text,
    )?.[1];
  return explicitlyLabeled
    ? brandLink(explicitlyLabeled, "https://x.com")
    : links.length === 1
      ? brandLink(links[0], "https://x.com")
      : "";
}
async function checkXJob(
  job: Job,
  signal?: AbortSignal,
): Promise<JobInspection> {
  const unavailable: JobInspection = {
    id: job.id,
    originalUrl: job.url,
    health: {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      url: job.url,
      reason: "The live X post could not be checked. It will be retried.",
    },
  };
  const response = await fetch(
    `https://x.pcstyle.dev/api/v1/posts?${new URLSearchParams({ url: job.url, format: "json", thread: "off", replies: "off", full: "true", nocache: "true" })}`,
    {
      headers: { Accept: "application/json" },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      cache: "no-store",
    },
  );
  const body = JSON.parse(
    new TextDecoder().decode(await boundedBytes(response.body, 1024 * 1024)),
  );
  // An upstream/provider 404 alone is not evidence that the original post was deleted.
  if (!response.ok) return unavailable;
  const post = Array.isArray(body.posts)
    ? body.posts.find((p: { url?: string }) => p.url === job.url)
    : undefined;
  if (!post?.text) return unavailable;
  const closed =
    /(?:this (?:job|role|position) (?:is|has been) (?:closed|filled)|no longer accepting applications|applications (?:are )?closed)/i.exec(
      String(post.text),
    );
  if (closed)
    return {
      ...unavailable,
      health: {
        ...unavailable.health,
        status: "closed",
        reason: "The hiring post says applications are closed.",
        evidence: closed[0],
      },
    };
  const applicationUrl = applicationLinkInPost(String(post.text));
  if (applicationUrl) {
    try {
      const page = await fetchPublicResource(applicationUrl, signal);
      const inspection = inspectJobPage({ ...job, url: applicationUrl }, page);
      inspection.originalUrl = job.url;
      if (!inspection.logoUrl && inspection.companyWebsite)
        Object.assign(
          inspection,
          await findWebsiteBrand(inspection.companyWebsite, signal),
        );
      return inspection;
    } catch {
      /* Keep a verified post when its linked application page blocks access. */
    }
  }
  return {
    ...unavailable,
    health: {
      ...unavailable.health,
      status: "unverified",
      reason:
        "The X hiring post exists. Its application availability could not be confirmed.",
    },
  };
}
// A logo search may resolve a unique official domain, but cannot select among similarly named employers.
async function findEmployerBrand(job: Job, signal?: AbortSignal) {
  if (!process.env.EXA_API_KEY) return {};
  try {
    const result = await searchCompany(
      "exa-company",
      `${job.company} official employer website ${job.role}. Return the employer's own website, not a directory or a job board.`,
      job.company,
      { signal },
    );
    const candidates = companyWebsiteCandidates(
      result.results,
      job.company,
    ).filter(
      (c) =>
        !/(linkedin\.com|ycombinator\.com|indeed\.com|glassdoor\.com|crunchbase\.com|wellfound\.com|github\.com|x\.com|twitter\.com|youtube\.com|wikipedia\.org)$/.test(
          new URL(c.url).hostname,
        ),
    );
    const domains = [
      ...new Set(
        candidates.map((c) => new URL(c.url).hostname.replace(/^www\./, "")),
      ),
    ];
    if (domains.length !== 1) return {};
    const website = new URL("/", candidates[0].url).href;
    const page = await fetchPublicResource(website, signal);
    if (page.status !== 200) return {};
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    let company;
    try {
      company = parseCompanyWebsite(
        page.body.toString("utf8"),
        page.url,
      ).company;
    } catch {
      const exact = candidates.find(
        (c) => normalize(c.title) === normalize(job.company) && c.favicon,
      );
      if (!exact?.favicon) return {};
      return {
        companyWebsite: page.url,
        logoUrl: brandLink(exact.favicon, exact.url),
        logoSource: exact.url,
      };
    }
    if (
      !(" " + normalize(company.name) + " ").includes(
        " " + normalize(job.company) + " ",
      )
    )
      return {};
    return {
      companyWebsite: page.url,
      ...(await findWebsiteBrand(page.url, signal)),
    };
  } catch {
    return {};
  }
}
export function applyJobInspections(
  workspace: Workspace,
  inspections: JobInspection[],
) {
  const archived: string[] = [];
  for (const item of inspections) {
    const job = workspace.jobs.find(
      (j) => j.id === item.id && j.url === item.originalUrl,
    );
    if (!job) continue; // Don't apply an old check to a user-edited link.
    job.health = {
      ...item.health,
      ...(job.health?.previousStage
        ? { previousStage: job.health.previousStage }
        : {}),
    };
    if (item.logoUrl) {
      job.logoUrl = item.logoUrl;
      job.logoSource = item.logoSource;
    }
    if (item.companyWebsite) job.companyWebsite = item.companyWebsite;
    if (item.health.status === "closed" && job.stage !== "Archived") {
      job.health.previousStage = job.stage;
      job.stage = "Archived";
      archived.push(job.id);
    }
    const company = workspace.companies.find((c) => c.id === job.companyId);
    if (company && item.logoUrl) {
      company.logoUrl = item.logoUrl;
      company.logoSource = item.logoSource;
    }
  }
  return archived;
}
export async function inspectWorkspaceJobs(
  workspace: Workspace,
  options: { force?: boolean; signal?: AbortSignal } = {},
) {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  const due = workspace.jobs
    .filter(
      (j) =>
        !j.sample &&
        j.url &&
        j.stage !== "Archived" &&
        (options.force || !j.health || Date.parse(j.health.checkedAt) < cutoff),
    )
    .slice(0, 60);
  const results: JobInspection[] = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, due.length) }, async () => {
      while (index < due.length && !options.signal?.aborted) {
        const job = due[index++];
        const company = workspace.companies.find((c) => c.id === job.companyId);
        const inspection = await checkJob(
          { ...job, companyWebsite: job.companyWebsite || company?.website },
          options.signal,
        );
        if (!inspection.logoUrl && !job.logoUrl && !options.signal?.aborted)
          Object.assign(
            inspection,
            await findEmployerBrand(job, options.signal),
          );
        results.push(inspection);
      }
    }),
  );
  return results;
}
