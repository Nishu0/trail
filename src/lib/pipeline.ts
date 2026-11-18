import type { Company, Draft, Job, Stage } from "./model";

export type PipelineGroup = "needs" | "waiting" | "new" | "closed";
export type PipelineTab = "all" | "needs" | "found" | "contacted" | "closed";

export const GROUPS: { id: PipelineGroup; label: string }[] = [
  { id: "needs", label: "Needs you" },
  { id: "waiting", label: "Waiting to hear back" },
  { id: "new", label: "New" },
  { id: "closed", label: "Closed" },
];

export const TABS: { id: PipelineTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs", label: "Needs you" },
  { id: "found", label: "Found" },
  { id: "contacted", label: "Contacted" },
  { id: "closed", label: "Closed" },
];

export const STAGE_LABEL: Record<Stage, string> = {
  Saved: "Found",
  Applied: "Contacted",
  Interview: "Interviewing",
  Offer: "Offer",
  Archived: "Closed",
};

export const MOVE_TARGETS: Stage[] = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Archived",
];

const DAY = 86_400_000;
// Follow-up dates are stored as plain dates; the workspace runs on India time.
const followUpTime = (date: string) =>
  new Date(`${date}T00:00:00+05:30`).getTime();

export function latestDraft(drafts: Draft[], jobId: string) {
  return drafts
    .filter((d) => d.jobId === jobId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function describe(
  job: Job,
  drafts: Draft[],
  now: Date,
): { group: PipelineGroup; next: string; tone: "ready" | "due" | "quiet" } {
  if (job.stage === "Archived")
    return { group: "closed", next: "Closed", tone: "quiet" };
  if (job.stage === "Offer")
    return { group: "closed", next: "Offer", tone: "quiet" };
  if (job.stage === "Saved")
    return latestDraft(drafts, job.id)
      ? { group: "needs", next: "Ready to send", tone: "ready" }
      : { group: "new", next: "Write the email", tone: "quiet" };
  if (!job.followUp)
    return {
      group: "waiting",
      next: job.stage === "Interview" ? "Interviewing" : "Waiting",
      tone: "quiet",
    };
  const left = followUpTime(job.followUp) - now.getTime();
  if (left <= 0) return { group: "needs", next: "Follow up now", tone: "due" };
  const days = Math.ceil(left / DAY);
  return {
    group: "waiting",
    next:
      left < DAY
        ? `Follow up in ${Math.max(1, Math.ceil(left / 3_600_000))}h`
        : `Follow up in ${days}d`,
    tone: "quiet",
  };
}

export function inTab(job: Job, group: PipelineGroup, tab: PipelineTab) {
  if (tab === "all") return true;
  if (tab === "needs") return group === "needs";
  if (tab === "found") return job.stage === "Saved";
  if (tab === "contacted")
    return job.stage === "Applied" || job.stage === "Interview";
  return group === "closed";
}

export function matches(job: Job, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${job.company} ${job.role} ${job.location} ${job.tags.join(" ")}`
    .toLowerCase()
    .includes(q);
}

export function companyFor(job: Job, companies: Company[]) {
  return companies.find((c) =>
    job.companyId
      ? c.id === job.companyId
      : c.name.toLowerCase() === job.company.toLowerCase(),
  );
}

/** The person to write to: a founder or hiring lead from saved company research. */
export function suggestedRecipient(job: Job, companies: Company[]) {
  const people = companyFor(job, companies)?.people ?? [];
  const rank = (role: string) => {
    const r = role.toLowerCase();
    if (/founder|ceo/.test(r)) return 0;
    if (/cto|head of engineering|vp eng|engineering manager/.test(r)) return 1;
    if (/recruit|talent|hiring|people/.test(r)) return 2;
    return 3;
  };
  return [...people].sort((a, b) => rank(a.role) - rank(b.role))[0];
}

export function websiteHost(job: Job, companies: Company[]) {
  const site = job.companyWebsite || companyFor(job, companies)?.website || "";
  try {
    return site ? new URL(site).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

export function followUpIn(days: number, from = new Date()) {
  return new Date(from.getTime() + days * DAY).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

export function mailtoLink(to: string, subject: string, body: string) {
  const params = new URLSearchParams({ subject, body })
    .toString()
    .replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(to.trim())}?${params}`;
}
