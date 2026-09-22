import { load } from "cheerio";
import { companySchema } from "./validation";
import { publicLink } from "./import-utils";
import { fetchProjectPage, githubRepository } from "./project-import";
import { brandLink, websiteBrand, findWebsiteBrand } from "./company-brand";
export async function importYCCompany(url: string, signal?: AbortSignal) {
  const input = new URL(url);
  const slug = /^\/companies\/([a-z0-9-]+)(?:\/jobs\/[^/]+)?\/?$/i.exec(
    input.pathname,
  )?.[1];
  if (
    input.hostname !== "www.ycombinator.com" ||
    input.protocol !== "https:" ||
    !slug
  )
    throw new Error(
      "Use a public YC company or job link from www.ycombinator.com.",
    );
  const source = `https://www.ycombinator.com/companies/${slug}`;
  const response = await fetch(source, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The YC company page is unavailable.");
  const $ = load(await response.text());
  const page = JSON.parse($("[data-page]").attr("data-page") || "{}");
  const c = page.props?.company;
  if (!c?.name)
    throw new Error(
      "YC changed its company page. Save the company and verified profiles manually.",
    );
  const safeLink = (value: unknown) =>
    typeof value === "string" && /^https?:\/\//.test(value) ? value : "";
  const github = safeLink(c.github_url);
  const repository =
    /^https:\/\/github.com\/([\w.-]+\/[\w.-]+)\/?$/.exec(github)?.[1] || "";
  const company = companySchema.parse({
    name: String(c.name),
    category: (c.tags || []).slice(0, 3).join(" · ") || "YC startup",
    description: String(c.long_description || c.one_liner || "").slice(0, 5000),
    website: safeLink(c.website),
    logoUrl:
      brandLink(c.logo_url || c.logoUrl || c.small_logo_url, source) ||
      undefined,
    logoSource: source,
    repo: repository,
    color: "#eef1e9",
    initials: c.name.slice(0, 1),
    notes: [
      `Research source: ${source}`,
      c.batch_name && `YC batch: ${c.batch_name}`,
      c.team_size && `Team size reported on YC: ${c.team_size}`,
      c.location && `Location: ${c.location}`,
      c.linkedin_url && `Company LinkedIn: ${safeLink(c.linkedin_url)}`,
      c.twitter_url && `Company X: ${safeLink(c.twitter_url)}`,
      `Checked: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n"),
    people: (c.founders || [])
      .filter(
        (f: { full_name?: string; is_active?: boolean }) =>
          f.full_name && f.is_active !== false,
      )
      .map(
        (f: {
          full_name: string;
          title?: string;
          linkedin_url?: string;
          twitter_url?: string;
        }) => ({
          name: f.full_name,
          role: f.title || "Founder (YC profile)",
          linkedin: safeLink(f.linkedin_url),
          x: safeLink(f.twitter_url),
          evidence: source,
        }),
      ),
  });

  if (!company.logoUrl && company.website)
    Object.assign(company, await findWebsiteBrand(company.website, signal));
  return { company, source };
}

export function parseCompanyWebsite(html: string, source: string) {
  const $ = load(html);
  let organization: Record<string, unknown> = {};
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    const item = value as Record<string, unknown>;
    const types = Array.isArray(item["@type"])
      ? item["@type"]
      : [item["@type"]];
    if (
      types.some((type) =>
        /^(Organization|Corporation|LocalBusiness)$/.test(String(type)),
      ) &&
      item.name
    )
      organization = item;
    if (item["@graph"]) visit(item["@graph"]);
  };
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      visit(JSON.parse($(element).text()));
    } catch {
      /* Ignore invalid metadata. */
    }
  });
  const name = String(
    organization.name ||
      $('meta[property="og:site_name"]').attr("content") ||
      $("title")
        .text()
        .split(/\s[|–—]\s/)[0],
  )
    .trim()
    .slice(0, 200);
  if (!name)
    throw new Error(
      "This website doesn’t identify its company. Add the company manually with a source.",
    );
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    try {
      const link = publicLink(new URL($(element).attr("href")!, source).href);
      if (link) links.add(link);
    } catch {
      /* Ignore invalid links. */
    }
  });
  const sameAs = organization.sameAs;
  for (const link of Array.isArray(sameAs) ? sameAs : [sameAs]) {
    const safe = publicLink(link);
    if (safe) links.add(safe);
  }
  const repos = [...new Set([...links].map(githubRepository).filter(Boolean))];
  const socials = [...links].filter((link) =>
    /^(www\.)?(linkedin\.com|x\.com|twitter\.com)$/.test(
      new URL(link).hostname,
    ),
  );
  const company = companySchema.parse({
    name,
    category: "Company website",
    description: String(
      organization.description ||
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "",
    ).slice(0, 5000),
    website: source,
    ...websiteBrand(html, source),
    repo: repos.length === 1 ? new URL(repos[0]).pathname.slice(1) : "",
    color: "#eef1e9",
    initials: name.slice(0, 1),
    people: [],
    notes: [
      `Research source: ${source}`,
      `Checked: ${new Date().toISOString()}`,
      ...socials.map((link) => `Social link on company website: ${link}`),
      ...(repos.length > 1
        ? repos.map((link) => `Repository candidate: ${link}`)
        : []),
    ]
      .join("\n")
      .slice(0, 6000),
  });
  return { company, source };
}
export async function importCompany(url: string, signal?: AbortSignal) {
  if (new URL(url).hostname === "www.ycombinator.com")
    return importYCCompany(url, signal);
  // Public pages are fetched through the existing DNS-pinned importer. No internal URLs.
  const deadline = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
    : AbortSignal.timeout(20000);
  return parseCompanyWebsite(await fetchProjectPage(url, 0, deadline), url);
}
