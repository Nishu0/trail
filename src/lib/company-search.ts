import { publicLink, boundedBytes } from "./import-utils";
export type ResearchProvider =
  "exa-company" | "exa-people" | "x-users" | "x-posts" | "linkedin";
export type ResearchCandidate = {
  title: string;
  url: string;
  summary: string;
  provider: string;
  kind: "company" | "person" | "post";
  favicon?: string;
};
export type CompanySearch = {
  results: ResearchCandidate[];
  checkedAt: string;
  query: string;
  provider: ResearchProvider;
  note: string;
  cached?: boolean;
};
export function normalizeResults(
  provider: ResearchProvider,
  body: Record<string, unknown>,
): ResearchCandidate[] {
  const raw = provider.startsWith("exa")
    ? body.results
    : provider === "linkedin"
      ? (body.web as { results?: unknown[] } | undefined)?.results
      : provider === "x-users"
        ? body.users
        : body.posts;
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item: Record<string, unknown>) => {
      const user = (item.user || item.author) as
        Record<string, unknown> | undefined;
      const title = String(
        item.title ||
          item.name ||
          user?.name ||
          item.screen_name ||
          "Public post",
      ).slice(0, 250);
      const url = publicLink(
        item.url ||
          item.html_url ||
          (item.screen_name ? `https://x.com/${item.screen_name}` : ""),
      );
      if (!url) return [];
      const hostname = new URL(url).hostname;
      if (
        provider === "linkedin" &&
        (!/^(www\.)?linkedin\.com$/.test(hostname) ||
          !new URL(url).pathname.startsWith("/in/"))
      )
        return [];
      if (
        provider.startsWith("x") &&
        !["x.com", "twitter.com", "www.x.com"].includes(hostname)
      )
        return [];
      const highlights = Array.isArray(item.highlights)
        ? item.highlights.join("\n")
        : "";
      return [
        {
          title,
          url,
          summary: String(
            item.summary ||
              item.description ||
              item.text ||
              item.full_text ||
              highlights ||
              "Open the source to review this result.",
          ).slice(0, 3500),
          provider: provider.startsWith("exa")
            ? "Exa"
            : provider === "linkedin"
              ? "Brave · public LinkedIn index"
              : "X public search",
          ...(provider === "exa-company" && publicLink(item.favicon)
            ? { favicon: publicLink(item.favicon) }
            : {}),
          kind:
            provider === "exa-company"
              ? ("company" as const)
              : provider === "x-posts"
                ? ("post" as const)
                : ("person" as const),
        },
      ];
    })
    .slice(0, 10);
}
// X searches can include unrelated people with similar surnames. Retain explicit
// company mentions or the exact requested person; do not infer employment.
export function relevantXProfiles(
  results: ResearchCandidate[],
  company: string,
  query: string,
) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const name = normalize(company),
    requested = normalize(query);
  const expression = new RegExp(
    `(^|[^a-z0-9])${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
    "i",
  );
  return results
    .filter(
      (result) =>
        normalize(result.title) === name ||
        expression.test(result.summary) ||
        (requested !== name && normalize(result.title) === requested),
    )
    .map((result) => ({
      ...result,
      kind:
        normalize(result.title) === name
          ? ("company" as const)
          : ("person" as const),
    }));
}
const cache = new Map<string, { expires: number; result: CompanySearch }>();
const calls: number[] = [];
export async function searchCompany(
  provider: ResearchProvider,
  query: string,
  company: string,
  options: { fresh?: boolean; signal?: AbortSignal } = {},
): Promise<CompanySearch> {
  const key = `${provider}:${company}:${query}`;
  const cached = cache.get(key);
  if (!options.fresh && cached && cached.expires > Date.now())
    return { ...cached.result, cached: true };
  // A shared local budget prevents accidental repeated paid requests.
  while (calls.length && calls[0] < Date.now() - 60000) calls.shift();
  if (calls.length >= 5)
    throw new Error(
      "Five searches were made this minute. Wait a minute before searching again.",
    );
  let url: string, init: RequestInit;
  if (provider.startsWith("exa")) {
    if (!process.env.EXA_API_KEY)
      throw new Error(
        "Add EXA_API_KEY to .env.local and restart Trail to enable Exa research.",
      );
    url = "https://api.exa.ai/search";
    init = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.EXA_API_KEY,
      },
      body: JSON.stringify({
        query,
        type: "auto",
        category: provider === "exa-people" ? "people" : "company",
        numResults: 8,
        contents: {
          highlights: true,
          ...(provider === "exa-company" ? { extras: { imageLinks: 1 } } : {}),
        },
      }),
    };
  } else if (provider === "linkedin") {
    if (!process.env.BRAVE_SEARCH_API_KEY)
      throw new Error(
        "Add BRAVE_SEARCH_API_KEY to .env.local and restart Trail. You can use the manual public-web search below in the meantime.",
      );
    url = `https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: `site:linkedin.com/in ${query}`, count: "10" })}`;
    init = {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
      },
    };
  } else {
    url = `https://x.pcstyle.dev/api/v1/search?${new URLSearchParams({ q: query, feed: provider === "x-users" ? "users" : "latest", format: "json", full: "true", limit: "8", ...(provider === "x-posts" ? { require_live: "true" } : {}) })}`;
    init = { headers: { Accept: "application/json" } };
  }
  calls.push(Date.now());
  const response = await fetch(url, {
    ...init,
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(25000)])
      : AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? `Search rate limit reached. Try again ${response.headers.get("retry-after") ? `in ${response.headers.get("retry-after")} seconds` : "later"}.`
        : response.status === 401 || response.status === 403
          ? "The provider rejected this API key or account. Check its access and credits."
          : `Search provider is unavailable (${response.status}). Try again later or use a source link.`,
    );
  const bytes = await boundedBytes(response.body, 2 * 1024 * 1024);
  const body = JSON.parse(new TextDecoder().decode(bytes));
  const result: CompanySearch = {
    results:
      provider === "x-users"
        ? relevantXProfiles(normalizeResults(provider, body), company, query)
        : normalizeResults(provider, body),
    query,
    provider,
    checkedAt: new Date().toISOString(),
    note:
      provider === "x-posts"
        ? "Live public posts. Confirm the company, author and date at the source."
        : "Search candidates, not confirmed employees. Review the source and current role before saving a person. Similar X names without an explicit company mention are omitted.",
  };
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 10 * 60000, result });
  return result;
}

// Keep similarly named businesses out of the website chooser for a known employer.
export function companyWebsiteCandidates(
  results: ResearchCandidate[],
  company: string,
) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const name = normalize(company);
  if (!name) return [];
  return results.filter(
    (result) =>
      ` ${normalize(result.title)} `.includes(` ${name} `) ||
      ` ${normalize(result.summary)} `.includes(` ${name} `),
  );
}
