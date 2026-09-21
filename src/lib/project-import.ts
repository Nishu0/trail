import { load } from "cheerio";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { github } from "./github";
import { publicLink } from "./import-utils";
import type { Project } from "./model";
export type ProjectImport = {
  project: Pick<
    Project,
    | "name"
    | "platform"
    | "url"
    | "description"
    | "stack"
    | "githubUrl"
    | "websiteUrl"
  >;
  githubCandidates: string[];
  devfolioProfiles?: { name: string; url: string }[];
  profileLinks?: { devfolio?: string };
  checkedAt: string;
  warnings: string[];
};
const blocked = new BlockList();
for (const [address, mask] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, mask, "ipv4");
for (const [address, mask] of [
  ["::", 128],
  ["::1", 128],

  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(address, mask, "ipv6");
export function privateAddress(address: string) {
  const family = isIP(address);
  return (
    !family ||
    address.toLowerCase().startsWith("::ffff:") ||
    blocked.check(address, family === 6 ? "ipv6" : "ipv4")
  );
}
export function projectURL(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    !url.hostname.includes(".") ||
    /\.(local|internal|localhost)$/i.test(url.hostname)
  )
    throw new Error(
      "Use a public HTTPS project link without credentials or a custom port.",
    );
  if (
    (url.hostname.endsWith("ethglobal.com") &&
      /^\/showcase\/?$/.test(url.pathname)) ||
    (url.hostname.endsWith("devfolio.co") &&
      /^\/projects\/?$/.test(url.pathname))
  )
    throw new Error(
      "Use the link to one project, rather than the project directory.",
    );
  return url;
}
// Resolve once, reject non-public addresses, and pin the TLS connection to that address.
// Every redirect is validated again, so public pages cannot redirect into the local network.
export async function fetchProjectPage(
  value: string,
  redirects = 0,
  signal?: AbortSignal,
): Promise<string> {
  const url = projectURL(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => privateAddress(a.address)))
    throw new Error("This project link does not resolve to a public website.");
  const pinned =
    addresses.find((address) => address.family === 4) || addresses[0];
  const result = await new Promise<{
    status: number;
    location?: string;
    type: string;
    body: string;
  }>((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        signal,
        headers: {
          "User-Agent": "Trail-project-import/1.0",
          Accept: "text/html",
        },
        family: pinned.family,
        lookup: (_host, options, callback) => {
          if (typeof options === "object" && "all" in options && options.all) {
            (
              callback as unknown as (
                error: null,
                values: { address: string; family: number }[],
              ) => void
            )(null, [pinned]);
          } else callback(null, pinned.address, pinned.family);
        },
      },
      (res) => {
        const status = res.statusCode || 500;
        const type = String(res.headers["content-type"] || "");
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, type, location: res.headers.location, body: "" });
          return;
        }
        if (
          status !== 200 ||
          !/text\/html|application\/xhtml\+xml/i.test(type)
        ) {
          res.resume();
          reject(
            new Error(
              `The project page could not be read (${status}). Paste its details manually if it requires a login.`,
            ),
          );
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024)
            req.destroy(
              new Error(
                "The project page is too large. Use its GitHub link instead.",
              ),
            );
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status,
            type,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    const deadline = setTimeout(
      () =>
        req.destroy(
          new Error(
            "The project page took too long to respond. Try its GitHub link.",
          ),
        ),
      20000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("error", reject);
    req.end();
  });
  if (result.status >= 300 && result.status < 400) {
    if (!result.location || redirects >= 3)
      throw new Error("Too many redirects in this project link.");
    return fetchProjectPage(
      new URL(result.location, url).href,
      redirects + 1,
      signal,
    );
  }
  return result.body;
}
export function githubRepository(value: string) {
  try {
    const url = new URL(value);
    if (!["github.com", "www.github.com"].includes(url.hostname)) return "";
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (
      !owner ||
      !repo ||
      [".", ".."].includes(owner) ||
      [".", ".."].includes(repo) ||
      !/^[\w.-]+$/.test(owner) ||
      !/^[\w.-]+$/.test(repo) ||
      [
        "login",
        "signup",
        "features",
        "topics",
        "orgs",
        "settings",
        "sponsors",
        "marketplace",
        "collections",
        "explore",
        "search",
      ].includes(owner.toLowerCase())
    )
      return "";
    return `https://github.com/${owner}/${repo.replace(/\.git$/, "")}`;
  } catch {
    return "";
  }
}
export function parseProjectPage(html: string, url: string): ProjectImport {
  const $ = load(html);
  const hostname = new URL(url).hostname;
  const platform = hostname.includes("devfolio.co")
    ? "Devfolio"
    : hostname.includes("ethglobal.com")
      ? "ETHGlobal"
      : hostname.includes("devpost.com")
        ? "Devpost"
        : "Personal";
  const githubCandidates = new Set<string>();
  const websites = new Set<string>();
  const devfolioProfiles = new Map<string, { name: string; url: string }>();
  function collectWebsite(value: string) {
    try {
      const link = projectURL(new URL(value, url).href).href;
      const host = new URL(link).hostname.replace(/^www\./, "");
      if (
        host !== hostname.replace(/^www\./, "") &&
        !/^(github\.com|devfolio\.co|ethglobal\.com|devpost\.com|x\.com|twitter\.com|youtube\.com|youtu\.be|linkedin\.com|discord\.gg|t\.me)$/.test(
          host,
        )
      )
        websites.add(link);
    } catch {
      /* Keep unsupported links out of the project fields. */
    }
  }
  const collect = (value: string) => {
    for (const match of value.match(
      /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+/gi,
    ) || []) {
      const repo = githubRepository(match);
      if (repo) githubCandidates.add(repo);
    }
  };
  // Search project content, not navigation/footer links or unrelated script bundles.
  const scope = $("main").length ? $("main") : $("body");
  scope.find("a[href]").each((_i, element) => {
    if (platform === "Devfolio" && !$(element).closest("footer, nav").length) {
      try {
        const link = new URL($(element).attr("href") || "", url);
        if (
          link.protocol === "https:" &&
          link.hostname === "devfolio.co" &&
          /^\/@[a-z0-9_-]+\/?$/i.test(link.pathname)
        ) {
          const profileURL = `https://devfolio.co${link.pathname.replace(/\/$/, "")}`;
          devfolioProfiles.set(profileURL, {
            url: profileURL,
            name: $(element).text().trim().slice(0, 250),
          });
        }
      } catch {
        /* Ignore malformed contributor links. */
      }
    }
    if (!$(element).closest("footer, nav").length)
      collect($(element).attr("href") || "");
    if (
      !$(element).closest("footer, nav").length &&
      /\b(website|live|demo|visit|launch|try app)\b/i.test(
        $(element).text() + " " + ($(element).attr("aria-label") || ""),
      )
    )
      collectWebsite($(element).attr("href") || "");
  });
  $("script[type='application/ld+json'], script#__NEXT_DATA__").each((_i, el) =>
    collect($(el).text().replace(/\\\//g, "/")),
  );
  // App Router pages may embed the repository in streamed RSC data.
  $("script").each((_i, element) => {
    const data = $(element).text().replace(/\\/g, "");
    for (const match of data.match(
      /"(?:sourceCodeUrl|primaryRepository|githubUrl|sourceUrl)"\s*:\s*(?:"[^"]*"|\{[^}]*\})/g,
    ) || [])
      collect(match);
    for (const match of data.matchAll(
      /"(?:websiteUrl|demoUrl|liveUrl|projectUrl)"\s*:\s*"([^"]+)"/g,
    ))
      collectWebsite(match[1]);
  });
  $("script, style, nav, header, footer, noscript").remove();
  const title = (
    $("meta[property='og:title']").attr("content") ||
    $("h1").first().text() ||
    $("title").text()
  )
    .trim()
    .replace(/\s*[|–—]\s*(Devfolio|ETHGlobal|Devpost).*$/i, "")
    .slice(0, 250);
  const summary = (
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    ""
  ).trim();
  const paragraphs = [
    ...new Set(
      scope
        .find("h2,h3,p,li")
        .map((_i, el) => $(el).text().trim())
        .get()
        .filter((s) => s.length > 25),
    ),
  ]
    .join("\n")
    .slice(0, 9000);
  return {
    project: {
      name: title,
      platform,
      url,
      description: (summary || paragraphs).slice(0, 12000),
      stack: "",
      githubUrl: "",
      websiteUrl:
        platform === "Personal"
          ? url
          : websites.size === 1
            ? [...websites][0]
            : "",
    },
    githubCandidates: [...githubCandidates].slice(0, 10),
    devfolioProfiles: [...devfolioProfiles.values()].slice(0, 20),
    checkedAt: new Date().toISOString(),
    warnings: [
      "Imported context describes the project, not your personal contribution.",
      ...(githubCandidates.size > 1
        ? [
            "Multiple GitHub links found. Choose the repository for this project.",
          ]
        : []),
      ...(!summary && !paragraphs
        ? [
            "This page has little readable content. Add its description yourself or import GitHub.",
          ]
        : []),
    ],
  };
}
export async function importProject(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProjectImport> {
  projectURL(url);
  const directRepo = githubRepository(url);
  const result: ProjectImport = directRepo
    ? {
        project: {
          name: "",
          platform: "GitHub",
          url,
          description: "",
          stack: "",
          githubUrl: directRepo,
        },
        githubCandidates: [directRepo],
        checkedAt: new Date().toISOString(),
        warnings: [],
      }
    : parseProjectPage(await fetchProjectPage(url, 0, options.signal), url);
  // A single linked repo supplies context; multiple candidates require a user selection.
  const repo =
    directRepo ||
    (result.githubCandidates.length === 1 ? result.githubCandidates[0] : "");
  if (repo) {
    result.project.githubUrl = repo;
    const path = new URL(repo).pathname.slice(1);
    try {
      const meta = await github<{
        name: string;
        description: string | null;
        language: string | null;
        homepage?: string | null;
      }>(`repos/${path}`, options.signal);
      const [readme, languages] = await Promise.allSettled([
        github<{ content: string; encoding: string }>(
          `repos/${path}/readme`,
          options.signal,
        ),
        github<Record<string, number>>(
          `repos/${path}/languages`,
          options.signal,
        ),
      ]);
      if (!result.project.name) result.project.name = meta.name;
      if (!result.project.websiteUrl && meta.homepage)
        result.project.websiteUrl = publicLink(meta.homepage);
      if (directRepo) result.project.description = meta.description || "";
      if (
        (directRepo || !result.project.description) &&
        readme.status === "fulfilled" &&
        readme.value.encoding === "base64"
      ) {
        const context = Buffer.from(readme.value.content, "base64")
          .toString("utf8")
          .split(/^##\s/m)[0]
          .replace(/```[\s\S]*?```/g, "")
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/<[^>]*>/g, "")
          .replace(/^#+\s*/gm, "")
          .replace(/[*_`]/g, "")
          .trim()
          .slice(0, 1500);
        result.project.description = [result.project.description, context]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 15000);
      }
      result.project.stack =
        languages.status === "fulfilled"
          ? Object.keys(languages.value).slice(0, 10).join(", ")
          : meta.language || "";
    } catch (e) {
      result.warnings.push((e as Error).message);
    }
  }
  if (!result.project.name && !result.project.description)
    throw new Error(
      "No project context found. Check that the link is public, or add details manually.",
    );
  return result;
}
