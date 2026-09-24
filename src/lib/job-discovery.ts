import type { Workspace, Job, DiscoverySource } from "./model";
import { isEmployerExcluded } from "./employer-exclusions";
export function applyDiscovery(
  workspace: Workspace,
  result: { jobs: Job[]; sources: DiscoverySource[]; checkedAt: string },
) {
  for (const job of result.jobs) {
    if (isEmployerExcluded(job.company, job.url, workspace.employerExclusions))
      continue;
    const existing = workspace.jobs.find(
      (existing) => existing.url === job.url && !existing.sample,
    );
    if (existing) {
      // Refresh public source facts only for previously auto-discovered leads.
      // Application status, notes, follow-up dates and manually entered leads remain user-owned.
      if (existing.id === job.id) {
        if (existing.company !== job.company) delete existing.companyId;
        for (const field of [
          "company",
          "role",
          "description",
          "location",
          "tags",
        ] as const)
          Object.assign(existing, { [field]: job[field] });
      }
      continue;
    }
    workspace.jobs.unshift(job);
    const report = result.sources.find(
      (source) => source.source === job.source,
    );
    if (report) report.imported++;
  }
  workspace.lastDiscovery = result.checkedAt;
  workspace.discovery = {
    checkedAt: result.checkedAt,
    sources: result.sources,
  };
}
