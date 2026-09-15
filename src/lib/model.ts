import { matchingTerms } from "./job-matching";
export type Source = "YC" | "X" | "LinkedIn" | "Other";
export type Stage = "Saved" | "Applied" | "Interview" | "Offer" | "Archived";
export type Channel = "Email" | "X" | "Job form";
export type JobHealth = {
  status: "open" | "closed" | "unavailable" | "unverified";
  checkedAt: string;
  url: string;
  reason: string;
  evidence?: string;
  previousStage?: Exclude<Stage, "Archived">;
};
export type Job = {
  id: string;
  company: string;
  companyId?: string;
  companyWebsite?: string;
  logoUrl?: string;
  logoSource?: string;
  health?: JobHealth;
  role: string;
  source: Source;
  url: string;
  description: string;
  location: string;
  tags: string[];
  stage: Stage;
  channel?: Channel;
  appliedAt?: string;
  followUp?: string;
  notes: string;
  sample?: boolean;
  addedAt: string;
};
export type Project = {
  id: string;
  name: string;
  platform: string;
  url: string;
  description: string;
  stack: string;
  githubUrl?: string;
  websiteUrl?: string;
  repositoryCandidates?: string[];
  buildMode?: "" | "solo" | "team";
  contribution?: string;
  importedAt?: string;
};
export type Profile = {
  name: string;
  headline: string;
  bio: string;
  skills: string;
  target: string;
  location: string;
  github: string;
  devpost: string;
  devfolio: string;
  ethglobal: string;
  writing: string;
  projects: Project[];
  resume?: {
    id?: string;
    fileStored?: boolean;
    name: string;
    text: string;
    uploadedAt: string;
  };
};
export type Company = {
  id: string;
  name: string;
  category: string;
  description: string;
  website: string;
  logoUrl?: string;
  logoSource?: string;
  repo: string;
  color: string;
  initials: string;
  notes: string;
  people: {
    name: string;
    role: string;
    linkedin: string;
    x: string;
    evidence: string;
  }[];
};
export type Draft = {
  id: string;
  jobId: string;
  subject: string;
  body: string;
  createdAt: string;
  mode: "starter" | "ai";
};
export type DiscoverySource = {
  source: "YC" | "X" | "LinkedIn";
  status: "complete" | "unavailable" | "not_configured";
  query: string;
  checked: number;
  matched: number;
  imported: number;
  checkedAt: string;
  message: string;
};
export type EmployerExclusion = {
  key: string;
  name: string;
  aliases: string[];
  domains: string[];
  reason: string;
  sourceUrl: string;
};
export type Workspace = {
  version: 1;
  profile: Profile;
  jobs: Job[];
  companies: Company[];
  drafts: Draft[];
  activity: { id: string; text: string; at: string }[];
  employerExclusions?: EmployerExclusion[];
  lastDiscovery?: string;
  discovery?: { checkedAt: string; sources: DiscoverySource[] };
};
export const emptyProfile: Profile = {
  name: "",
  headline: "",
  bio: "",
  skills: "",
  target: "",
  location: "",
  github: "",
  devpost: "",
  devfolio: "",
  ethglobal: "",
  writing: "",
  projects: [],
};
export function initialWorkspace(): Workspace {
  return {
    version: 1,
    profile: { ...emptyProfile, projects: [] },
    jobs: [],
    companies: [],
    drafts: [],
    activity: [],
  };
}

export function fit(job: Job, profile: Profile) {
  const skills = profile.skills
    .split(/[,\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!skills.length) return { score: null, reasons: [] as string[] };
  const text =
    `${job.role} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  const reasons = matchingTerms(text, skills);
  return { score: Math.round((reasons.length / skills.length) * 100), reasons };
}
export function dueJobs(jobs: Job[], now = new Date()) {
  return jobs.filter(
    (j) =>
      !j.sample &&
      j.followUp &&
      ["Applied", "Interview"].includes(j.stage) &&
      new Date(`${j.followUp}T00:00:00+05:30`).getTime() <= now.getTime(),
  );
}
export function starterDraft(job: Job, profile: Profile) {
  const project = profile.projects.find((p) => p.description || p.name);
  return {
    subject: `${job.role} — ${profile.name || "a builder"}`,
    body: `Hi ${job.company} team,\n\nI came across your ${job.role.toLowerCase()} opening${job.source === "Other" ? "" : ` on ${job.source}`}. ${profile.bio || "[Add one sentence about your experience.]"}\n\n${project ? projectStory(project) : "[Add a relevant project, what you shipped, and a link.]"}\n\n${job.notes ? `${job.notes}\n\n` : "[Add a specific detail about the company’s work and why it interests you.]\n\n"}If that’s useful for the team, I’d love to chat about where I could contribute.\n\n${profile.name || "[Your name]"}${profile.github ? `\nhttps://github.com/${profile.github.replace(/^https:\/\/github.com\//, "")}` : ""}`,
  };
}
export function projectStory(project: Project) {
  const opening =
    project.buildMode === "solo"
      ? `I built ${project.name} on my own.`
      : project.buildMode === "team"
        ? `I worked with a team on ${project.name}.`
        : `One project I'd like to share is ${project.name}.`;
  return [
    opening,
    project.description,
    project.buildMode === "team"
      ? project.contribution?.trim() || "[Add what you personally contributed.]"
      : "",
    project.url,
    project.githubUrl && project.githubUrl !== project.url
      ? project.githubUrl
      : "",
    project.websiteUrl && project.websiteUrl !== project.url
      ? project.websiteUrl
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
