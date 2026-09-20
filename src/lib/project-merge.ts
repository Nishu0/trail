import type { Project } from "./model";

const nameKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
function linkKey(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/$/, "").replace(/\.git$/, "")}`;
  } catch {
    return "";
  }
}
const links = (p: Project) =>
  [p.url, p.githubUrl, p.websiteUrl].map(linkKey).filter(Boolean);
export function sameProject(a: Project, b: Project) {
  return (
    (!!nameKey(a.name) && nameKey(a.name) === nameKey(b.name)) ||
    links(a).some((link) => links(b).includes(link))
  );
}
// Keep edits, identifiers and ownership answers when a résumé is imported again.
export function mergeProjects(existing: Project[], incoming: Project[]) {
  const projects = existing.map((project) => ({ ...project }));
  for (const project of incoming) {
    const index = projects.findIndex((current) =>
      sameProject(current, project),
    );
    if (index < 0) {
      if (projects.length < 40) projects.push({ ...project });
      continue;
    }
    const current = projects[index];
    if (project.repositoryCandidates?.length)
      current.repositoryCandidates = [
        ...new Set([
          ...(current.repositoryCandidates || []),
          ...project.repositoryCandidates,
        ]),
      ].slice(0, 10);
    for (const key of [
      "name",
      "url",
      "description",
      "stack",
      "githubUrl",
      "websiteUrl",
      "importedAt",
    ] as const)
      if (!current[key]?.trim() && project[key]) current[key] = project[key];
  }
  return projects;
}
