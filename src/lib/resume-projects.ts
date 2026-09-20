import type { Project } from "./model";
import { importProject, githubRepository, projectURL } from "./project-import";
import { publicLink } from "./import-utils";
import { mergeProjects } from "./project-merge";
import { resumeLines, resumeHeading, projectsHeading } from "./resume-layout";
import { github } from "./github";

export type ResumeProjectFacts = {
  name: string;
  description: string;
  stack: string;
  links: string[];
};
export function resumeURLs(text: string) {
  return [
    ...new Set(
      (
        text.match(
          /https?:\/\/[^\s<>"'\]]+|(?:www\.)?(?:github\.com|devfolio\.co|devpost\.com|ethglobal\.com)\/[^\s<>"'\]]+/gi,
        ) || []
      )
        .map((value) =>
          publicLink(
            (/^https?:/i.test(value) ? value : `https://${value}`).replace(
              /[),.;]+$/,
              "",
            ),
          ),
        )
        .filter(Boolean),
    ),
  ];
}
function platform(url: string) {
  if (!url) return "Personal";
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host === "github.com"
    ? "GitHub"
    : host === "devfolio.co"
      ? "Devfolio"
      : host === "ethglobal.com"
        ? "ETHGlobal"
        : host === "devpost.com"
          ? "Devpost"
          : "Personal";
}
function projectLink(url: string) {
  try {
    projectURL(url);
    const u = new URL(url);
    return (
      !!githubRepository(url) ||
      (/[.]?(devfolio\.co|ethglobal\.com|devpost\.com)$/.test(u.hostname) &&
        /\/(projects?|software|showcase)\//.test(u.pathname))
    );
  } catch {
    return false;
  }
}
export function projectFromFacts(
  facts: ResumeProjectFacts,
  allowedLinks: string[],
): Project {
  const supplied = new Set(allowedLinks.map((value) => publicLink(value)));
  const links = facts.links
    .map((value) => publicLink(value))
    .filter((value) => supplied.has(value) && value);
  const githubUrl = links.map(githubRepository).find(Boolean) || "";
  const websiteUrl =
    links.find(
      (url) => !githubRepository(url) && platform(url) === "Personal",
    ) || "";
  const url =
    links.find((url) =>
      ["Devfolio", "ETHGlobal", "Devpost"].includes(platform(url)),
    ) ||
    websiteUrl ||
    githubUrl;
  return {
    id: crypto.randomUUID(),
    name: facts.name.trim().slice(0, 250),
    description: facts.description.trim().slice(0, 6000),
    stack: facts.stack.trim().slice(0, 1000),
    platform: platform(url),
    url,
    githubUrl,
    websiteUrl,
    buildMode: "",
    contribution: "",
  };
}
// Deterministic extraction keeps projects useful when Claude is switched off.
export function localResumeProjects(text: string): ResumeProjectFacts[] {
  const lines = resumeLines(text);
  const start = lines.findIndex((line) => projectsHeading.test(line));
  if (start < 0) return [];
  const result: ResumeProjectFacts[] = [];
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (resumeHeading.test(line) || /^Hyperlink context:/i.test(line)) break;
    if (
      /^(?:tech(?:nology)? stack|technologies|built with|stack)\s*:/i.test(
        line,
      ) &&
      result.length
    ) {
      result[result.length - 1].stack = line.replace(/^[^:]+:\s*/, "");
      continue;
    }
    const title =
      !/^[•●\-*]|^https?:|^Link:/i.test(line) &&
      line.length < 200 &&
      (/\s[·|–—]\s/.test(line) ||
        (/^[\p{Lu}\d]/u.test(line) &&
          line.length < 80 &&
          line.split(/\s+/).length <= 6 &&
          (!result.length || /^[•●\-*]/.test(lines[index + 1] || ""))));
    if (title) {
      const plain = line
        .replace(/^\d+[.)]\s*/, "")
        .replace(/\[https?:[^\]]+\]/g, "")
        .replace(
          /\s+(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+)?20\d{2}.*$/i,
          "",
        );
      const [name, ...stack] = plain.split(/\s[·|–—]\s/);
      result.push({
        name: name.trim(),
        stack: stack.join(", ").trim(),
        description: "",
        links: resumeURLs(line),
      });
    } else if (result.length) {
      const current = result[result.length - 1];
      current.links.push(...resumeURLs(line));
      if (!/^https?:|^Link:/i.test(line))
        current.description += `${current.description ? " " : ""}${line.replace(/^[•●\-*]\s*/, "")}`;
    }
  }
  const allLinks = resumeURLs(text);
  for (const project of result) {
    if (project.links.length) continue;
    const key = project.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    project.links = allLinks.filter((url) => {
      const u = new URL(url);
      return (
        key.length > 3 &&
        (u.hostname
          .replace(/^www\./, "")
          .split(".")[0]
          .replace(/[^a-z0-9]/g, "") === key ||
          u.hostname
            .replace(/^www\./, "")
            .split(".")[0]
            .toLowerCase()
            .startsWith(`${key}-`) ||
          u.pathname
            .split("/")
            .filter(Boolean)
            .some(
              (part) => part.toLowerCase().replace(/[^a-z0-9]/g, "") === key,
            ))
      );
    });
  }
  return result.slice(0, 20);
}

export async function enrichResumeProjects(
  text: string,
  facts: ResumeProjectFacts[],
  options: {
    signal?: AbortSignal;
    importer?: typeof importProject;
    githubUsername?: string;
  } = {},
) {
  const suppliedLinks = resumeURLs(text);
  let projects = facts
    .filter((fact) => fact.name.trim())
    .map((fact) => projectFromFacts(fact, suppliedLinks));
  projects = mergeProjects([], projects);
  // A hackathon/repository link is still a project even when its name was absent in the text.
  for (const url of suppliedLinks.filter(projectLink)) {
    if (
      projects.some((project) =>
        [project.url, project.githubUrl, project.websiteUrl].includes(url),
      )
    )
      continue;
    const slug =
      new URL(url).pathname.split("/").filter(Boolean).pop() ||
      "Linked project";
    projects.push(
      projectFromFacts(
        {
          name: slug.replace(/-[a-f0-9]{4,}$/i, "").replace(/[-_]/g, " "),
          description: "",
          stack: "",
          links: [url],
        },
        suppliedLinks,
      ),
    );
  }
  const warnings: string[] = [];
  const devfolioProfiles: NonNullable<
    Awaited<ReturnType<typeof importProject>>["devfolioProfiles"]
  > = [];
  const importer = options.importer || importProject;
  // Bound concurrency, upstream deadlines and total projects; one dead site must not lose the résumé.
  const bounded = projects.slice(0, 20);
  if (projects.length > bounded.length)
    warnings.push(
      "This import includes the first 20 projects. Add the remaining projects using their individual links.",
    );
  const deadline = Date.now() + 30000;
  for (let offset = 0; offset < bounded.length; offset += 3) {
    options.signal?.throwIfAborted();
    const enriched = await Promise.all(
      bounded.slice(offset, offset + 3).map(async (project) => {
        if (!project.url) return project;
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          warnings.push(
            `${project.name}: website enrichment is pending. The document details and links are retained; refresh this project to retry.`,
          );
          return project;
        }
        try {
          const result = await importer(project.url, {
            signal: options.signal
              ? AbortSignal.any([
                  options.signal,
                  AbortSignal.timeout(Math.min(12000, remaining)),
                ])
              : AbortSignal.timeout(Math.min(12000, remaining)),
          });
          devfolioProfiles.push(...(result.devfolioProfiles || []));
          warnings.push(
            ...result.warnings
              .filter((w) => !w.startsWith("Imported context"))
              .map((w) => `${project.name}: ${w}`),
          );
          return {
            ...project,
            name: project.description
              ? project.name
              : result.project.name || project.name,
            description:
              project.description || result.project.description.slice(0, 6000),
            stack: project.stack || result.project.stack,
            githubUrl: project.githubUrl || result.project.githubUrl || "",
            repositoryCandidates: result.githubCandidates,
            websiteUrl: project.websiteUrl || result.project.websiteUrl || "",
            importedAt: result.checkedAt,
          };
        } catch {
          options.signal?.throwIfAborted();
          warnings.push(
            `${project.name}: couldn’t read the linked page. The résumé details and original link are kept.`,
          );
          return project;
        }
      }),
    );
    bounded.splice(offset, enriched.length, ...enriched);
  }
  let matched = bounded;
  try {
    matched = await attachResumeRepositories(bounded, {
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
  } catch {
    options.signal?.throwIfAborted();
    warnings.push(
      "Repository lookup could not finish. Project facts and existing links are retained; retry individual projects to finish enrichment.",
    );
  }
  return { projects: mergeProjects([], matched), warnings, devfolioProfiles };
}

export async function attachResumeRepositories(
  projects: Project[],
  options: {
    githubUsername?: string;
    signal?: AbortSignal;
    importer?: typeof importProject;
    listRepos?: (
      username: string,
    ) => Promise<{ name: string; html_url: string; fork: boolean }[]>;
  },
) {
  if (
    !options.githubUsername ||
    !/^[a-z0-9-]{1,39}$/i.test(options.githubUsername) ||
    projects.every((p) => p.githubUrl)
  )
    return projects;
  try {
    // Match only actual public repositories on the user's supplied GitHub account.
    const repos = await (options.listRepos
      ? options.listRepos(options.githubUsername)
      : github<{ name: string; html_url: string; fork: boolean }[]>(
          `users/${options.githubUsername}/repos?per_page=100&sort=updated`,
          options.signal,
        ));
    const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return await Promise.all(
      projects.map(async (project) => {
        if (project.githubUrl) return project;
        const matches = repos
          .filter((repo) => !repo.fork && key(repo.name) === key(project.name))
          .map((repo) => githubRepository(repo.html_url))
          .filter(
            (url) =>
              !!url &&
              new URL(url).pathname.split("/")[1].toLowerCase() ===
                options.githubUsername!.toLowerCase(),
          );
        if (!matches.length) return project;
        if (matches.length > 1)
          return {
            ...project,
            repositoryCandidates: [
              ...new Set([...(project.repositoryCandidates || []), ...matches]),
            ].slice(0, 10),
          };
        const result = {
          ...project,
          githubUrl: matches[0],
          repositoryCandidates: [
            ...new Set([...(project.repositoryCandidates || []), matches[0]]),
          ],
        };
        if (!result.url) {
          result.url = matches[0];
          result.platform = "GitHub";
        }
        try {
          const details = await (options.importer || importProject)(
            matches[0],
            {
              signal: options.signal
                ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
                : AbortSignal.timeout(10000),
            },
          );
          result.websiteUrl ||= details.project.websiteUrl;
          result.stack ||= details.project.stack;
          result.importedAt = details.checkedAt;
        } catch {
          options.signal?.throwIfAborted();
        }
        return result;
      }),
    );
  } catch {
    options.signal?.throwIfAborted();
    return projects;
  }
}

export function mergeResumeFacts(
  local: ResumeProjectFacts[],
  extracted: ResumeProjectFacts[],
  text: string,
) {
  const allowed = new Set(resumeURLs(text));
  const result: ResumeProjectFacts[] = [];
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const fact of [...local, ...extracted]) {
    const links = [
      ...new Set(
        fact.links.map(publicLink).filter((link) => allowed.has(link)),
      ),
    ];
    const existing = result.find(
      (item) =>
        key(item.name) === key(fact.name) ||
        (links.length > 0 && item.links.some((link) => links.includes(link))),
    );
    if (existing) {
      existing.links = [...new Set([...existing.links, ...links])];
      existing.description ||= fact.description;
      existing.stack ||= fact.stack;
    } else result.push({ ...fact, links });
  }
  return result.slice(0, 20);
}
