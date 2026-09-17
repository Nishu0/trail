import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  bigserial,
  boolean,
  date,
  jsonb,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import type { ResumeFields } from "../lib/resume";
import type { JobHealth } from "../lib/model";
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });
const binary = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
export const jobSource = pgEnum("trail_job_source", [
  "YC",
  "X",
  "LinkedIn",
  "Other",
]);
export const applicationStage = pgEnum("trail_application_stage", [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Archived",
]);
export const applicationChannel = pgEnum("trail_application_channel", [
  "Email",
  "X",
  "Job form",
]);
export const buildMode = pgEnum("trail_project_build_mode", ["solo", "team"]);
export const draftMode = pgEnum("trail_draft_mode", ["starter", "ai"]);
export const resumeStatus = pgEnum("trail_resume_status", [
  "processing",
  "ready",
  "failed",
]);
export const users = pgTable("trail_users", {
  id: uuid("id").primaryKey(),
  authSubject: text("auth_subject").unique(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const workspaces = pgTable(
  "trail_workspaces",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastDiscovery: time("last_discovery"),
    legacyImportedAt: time("legacy_imported_at"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("trail_workspaces_owner_idx").on(t.ownerId)],
);
export const profiles = pgTable("trail_profiles", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  skills: text("skills").notNull().default(""),
  target: text("target").notNull().default(""),
  location: text("location").notNull().default(""),
  github: text("github").notNull().default(""),
  devpost: text("devpost").notNull().default(""),
  devfolio: text("devfolio").notNull().default(""),
  ethglobal: text("ethglobal").notNull().default(""),
  writing: text("writing").notNull().default(""),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const employerExclusions = pgTable(
  "trail_employer_exclusions",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull(),
    domains: text("domains").array().notNull(),
    reason: text("reason").notNull(),
    sourceUrl: text("source_url").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);
export const projects = pgTable(
  "trail_projects",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => profiles.workspaceId, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    platform: text("platform").notNull(),
    url: text("url").notNull(),
    description: text("description").notNull(),
    stack: text("stack").notNull(),
    githubUrl: text("github_url"),
    websiteUrl: text("website_url"),
    repositoryCandidates: text("repository_candidates").array(),
    buildMode: buildMode("build_mode"),
    contribution: text("contribution"),
    importedAt: time("imported_at"),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.id] })],
);
export const resumes = pgTable(
  "trail_resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => profiles.workspaceId, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    content: binary("content"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    extractedText: text("extracted_text").notNull().default(""),
    extractedFields: jsonb("extracted_fields").$type<Partial<ResumeFields>>(),
    model: text("model"),
    status: resumeStatus("status").notNull().default("processing"),
    error: text("error"),
    active: boolean("active").notNull().default(false),
    uploadedAt: time("uploaded_at").notNull().defaultNow(),
  },
  (t) => [
    index("trail_resumes_workspace_idx").on(t.workspaceId),
    uniqueIndex("trail_resumes_active_unique")
      .on(t.workspaceId)
      .where(sql`${t.active} = true`),
  ],
);
export const companies = pgTable(
  "trail_companies",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    website: text("website").notNull(),
    logoUrl: text("logo_url"),
    logoSource: text("logo_source"),
    repo: text("repo").notNull(),
    color: text("color").notNull(),
    initials: text("initials").notNull(),
    notes: text("notes").notNull(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index("trail_companies_name_idx").on(t.workspaceId, t.name),
  ],
);
export const companyPeople = pgTable(
  "trail_company_people",
  {
    workspaceId: uuid("workspace_id").notNull(),
    companyId: text("company_id").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    linkedin: text("linkedin").notNull(),
    x: text("x").notNull(),
    evidence: text("evidence").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.companyId, t.position] }),
    foreignKey({
      columns: [t.workspaceId, t.companyId],
      foreignColumns: [companies.workspaceId, companies.id],
    }).onDelete("cascade"),
  ],
);
export const jobs = pgTable(
  "trail_jobs",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    company: text("company").notNull(),
    companyId: text("company_id"),
    companyWebsite: text("company_website"),
    logoUrl: text("logo_url"),
    logoSource: text("logo_source"),
    health: jsonb("health").$type<JobHealth>(),
    role: text("role").notNull(),
    source: jobSource("source").notNull(),
    url: text("url").notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sample: boolean("sample").notNull().default(false),
    addedAt: time("added_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    foreignKey({
      columns: [t.workspaceId, t.companyId],
      foreignColumns: [companies.workspaceId, companies.id],
    }),
    index("trail_jobs_source_idx").on(t.workspaceId, t.source),
    uniqueIndex("trail_jobs_source_url_unique")
      .on(t.workspaceId, t.url)
      .where(sql`${t.url} <> '' AND ${t.sample} = false`),
  ],
);
// Public brand images are cached separately from personal workspace records.
export const brandAssets = pgTable("trail_brand_assets", {
  url: text("url").primaryKey(),
  content: binary("content").notNull(),
  contentType: text("content_type").notNull(),
  checkedAt: time("checked_at").notNull().defaultNow(),
});
export const applications = pgTable(
  "trail_applications",
  {
    workspaceId: uuid("workspace_id").notNull(),
    jobId: text("job_id").notNull(),
    stage: applicationStage("stage").notNull().default("Saved"),
    channel: applicationChannel("channel"),
    appliedAt: time("applied_at"),
    followUp: date("follow_up", { mode: "string" }),
    notes: text("notes").notNull().default(""),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.jobId] }),
    foreignKey({
      columns: [t.workspaceId, t.jobId],
      foreignColumns: [jobs.workspaceId, jobs.id],
    }).onDelete("cascade"),
    index("trail_applications_followup_idx").on(
      t.workspaceId,
      t.stage,
      t.followUp,
    ),
  ],
);
export const drafts = pgTable(
  "trail_drafts",
  {
    workspaceId: uuid("workspace_id").notNull(),
    id: text("id").notNull(),
    jobId: text("job_id").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    mode: draftMode("mode").notNull(),
    createdAt: time("created_at").notNull(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    foreignKey({
      columns: [t.workspaceId, t.jobId],
      foreignColumns: [jobs.workspaceId, jobs.id],
    }).onDelete("cascade"),
    index("trail_drafts_job_idx").on(t.workspaceId, t.jobId),
  ],
);
export const activity = pgTable(
  "trail_activity",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    at: time("at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index("trail_activity_time_idx").on(t.workspaceId, t.at),
  ],
);

export const discoveryStatus = pgEnum("trail_discovery_status", [
  "complete",
  "unavailable",
  "not_configured",
]);
export const discoverySources = pgTable(
  "trail_discovery_sources",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: jobSource("source").notNull(),
    status: discoveryStatus("status").notNull(),
    query: text("query").notNull(),
    checked: integer("checked").notNull(),
    matched: integer("matched").notNull(),
    imported: integer("imported").notNull(),
    checkedAt: time("checked_at").notNull(),
    message: text("message").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.source] })],
);

export const linkedInProfiles = pgTable("trail_linkedin_profiles", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  profileUrl: text("profile_url").notNull().default(""),
  lastCheckedAt: time("last_checked_at"),
  syncStatus: text("sync_status").notNull().default("not_checked"),
  syncNote: text("sync_note").notNull().default(""),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const linkedInSections = pgTable(
  "trail_linkedin_sections",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => linkedInProfiles.workspaceId, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    company: text("company").notNull().default(""),
    title: text("title").notNull().default(""),
    dates: text("dates").notNull().default(""),
    currentText: text("current_text").notNull().default(""),
    facts: text("facts").notNull().default(""),
    version: integer("version").notNull().default(1),
    source: text("source").notNull().default("manual"),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.id] })],
);
export const linkedInSnapshots = pgTable(
  "trail_linkedin_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => linkedInProfiles.workspaceId, { onDelete: "cascade" }),
    source: text("source").notNull(),
    status: text("status").notNull(),
    profileUrl: text("profile_url").notNull(),
    text: text("text").notNull().default(""),
    note: text("note").notNull().default(""),
    checkedAt: time("checked_at").notNull().defaultNow(),
  },
  (t) => [
    index("trail_linkedin_snapshot_time_idx").on(t.workspaceId, t.checkedAt),
  ],
);
export const linkedInResearchRuns = pgTable(
  "trail_linkedin_research_runs",
  {
    id: uuid("id").notNull().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    requestedCount: integer("requested_count").notNull().default(100),
    reviewedCount: integer("reviewed_count").notNull().default(0),
    methodology: text("methodology").notNull(),
    insights: jsonb("insights")
      .$type<import("../lib/linkedin-types").ResearchInsight[]>()
      .notNull()
      .default([]),
    error: text("error"),
    startedAt: time("started_at").notNull().defaultNow(),
    completedAt: time("completed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index("trail_linkedin_research_time_idx").on(t.workspaceId, t.startedAt),
  ],
);
export const linkedInResearchProfiles = pgTable(
  "trail_linkedin_research_profiles",
  {
    workspaceId: uuid("workspace_id").notNull(),
    runId: uuid("run_id").notNull(),
    url: text("url").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    cohort: text("cohort").notNull(),
    query: text("query").notNull(),
    checkedAt: time("checked_at").notNull(),
    summary: text("summary").notNull(),
    takeaway: text("takeaway").notNull(),
    evidence: text("evidence").notNull(),
    signals: text("signals").array().notNull(),
    caution: text("caution").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.runId, t.url] }),
    foreignKey({
      columns: [t.workspaceId, t.runId],
      foreignColumns: [
        linkedInResearchRuns.workspaceId,
        linkedInResearchRuns.id,
      ],
    }).onDelete("cascade"),
  ],
);
export const linkedInMessages = pgTable(
  "trail_linkedin_messages",
  {
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    id: uuid("id").notNull().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => linkedInProfiles.workspaceId, { onDelete: "cascade" }),
    sectionId: text("section_id"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index("trail_linkedin_messages_time_idx").on(t.workspaceId, t.createdAt),
  ],
);
export const linkedInRevisions = pgTable(
  "trail_linkedin_revisions",
  {
    id: uuid("id").notNull().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    messageId: uuid("message_id").notNull(),
    sectionId: text("section_id").notNull(),
    baseVersion: integer("base_version").notNull().default(1),
    beforeText: text("before_text").notNull(),
    afterText: text("after_text").notNull(),
    rationale: text("rationale").notNull(),
    supportingFacts: text("supporting_facts").array().notNull(),
    missingMetrics: text("missing_metrics").array().notNull(),
    status: text("status").notNull().default("proposed"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    foreignKey({
      columns: [t.workspaceId, t.messageId],
      foreignColumns: [linkedInMessages.workspaceId, linkedInMessages.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.workspaceId, t.sectionId],
      foreignColumns: [linkedInSections.workspaceId, linkedInSections.id],
    }).onDelete("cascade"),
  ],
);
