import { and, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn, PgDatabase } from "drizzle-orm/pg-core";
import * as s from "./schema";
import {
  initialWorkspace,
  type Workspace,
  type DiscoverySource,
} from "../lib/model";
// Driver-independent queries let tests exercise the same repository on PostgreSQL/PGlite.
type Database = PgDatabase<any, typeof s>;
export const DEFAULT_WORKSPACE_ID = "4d063d79-f44f-4a32-b56e-1ac8e8f402a7";
import { sameLegacyFacts } from "./legacy";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const iso = (v: string) => new Date(v).toISOString();
export function createWorkspaceRepository(
  db: Database,
  workspaceId = DEFAULT_WORKSPACE_ID,
) {
  async function load(tx: Database): Promise<Workspace> {
    const scope = (table: { workspaceId: AnyPgColumn }) =>
      eq(table.workspaceId, workspaceId);
    const [
      meta,
      profileRows,
      projectRows,
      resumeRows,
      companyRows,
      peopleRows,
      jobRows,
      applicationRows,
      draftRows,
      activityRows,
      discoveryRows,
      exclusionRows,
    ] = await Promise.all([
      tx.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId)),
      tx.select().from(s.profiles).where(scope(s.profiles)),
      tx
        .select()
        .from(s.projects)
        .where(scope(s.projects))
        .orderBy(s.projects.position),
      tx
        .select({
          id: s.resumes.id,
          fileStored: sql<boolean>`${s.resumes.content} IS NOT NULL`,
          filename: s.resumes.filename,
          text: s.resumes.extractedText,
          uploadedAt: s.resumes.uploadedAt,
        })
        .from(s.resumes)
        .where(and(scope(s.resumes), eq(s.resumes.active, true))),
      tx
        .select()
        .from(s.companies)
        .where(scope(s.companies))
        .orderBy(s.companies.position),
      tx
        .select()
        .from(s.companyPeople)
        .where(scope(s.companyPeople))
        .orderBy(s.companyPeople.position),
      tx.select().from(s.jobs).where(scope(s.jobs)).orderBy(s.jobs.position),
      tx.select().from(s.applications).where(scope(s.applications)),
      tx
        .select()
        .from(s.drafts)
        .where(scope(s.drafts))
        .orderBy(s.drafts.createdAt),
      tx
        .select()
        .from(s.activity)
        .where(scope(s.activity))
        .orderBy(s.activity.position),
      tx.select().from(s.discoverySources).where(scope(s.discoverySources)),
      tx.select().from(s.employerExclusions).where(scope(s.employerExclusions)),
    ]);
    if (!profileRows[0])
      throw new Error("Workspace profile is missing. Run database setup.");
    const { workspaceId: _, updatedAt: __, ...profile } = profileRows[0];
    const apps = new Map(applicationRows.map((row) => [row.jobId, row]));
    const resume = resumeRows[0];
    return {
      version: 1,
      ...(exclusionRows.length
        ? {
            employerExclusions: exclusionRows.map(
              ({ workspaceId, createdAt, ...exclusion }) => exclusion,
            ),
          }
        : {}),
      profile: {
        ...profile,
        projects: projectRows.map(
          ({ workspaceId, position, updatedAt, ...p }) => ({
            ...p,
            githubUrl: p.githubUrl ?? undefined,
            websiteUrl: p.websiteUrl ?? undefined,
            repositoryCandidates: p.repositoryCandidates ?? undefined,
            buildMode: p.buildMode ?? "",
            contribution: p.contribution ?? undefined,
            importedAt: p.importedAt ? iso(p.importedAt) : undefined,
          }),
        ),
        ...(resume
          ? {
              resume: {
                id: resume.id,
                fileStored: resume.fileStored,
                name: resume.filename,
                text: resume.text,
                uploadedAt: iso(resume.uploadedAt),
              },
            }
          : {}),
      },
      companies: companyRows.map(
        ({ workspaceId, position, updatedAt, ...company }) => ({
          ...company,
          logoUrl: company.logoUrl ?? undefined,
          logoSource: company.logoSource ?? undefined,
          people: peopleRows
            .filter((p) => p.companyId === company.id)
            .map(({ workspaceId, companyId, position, ...person }) => person),
        }),
      ),
      jobs: jobRows.map(({ workspaceId, position, ...job }) => {
        const app = apps.get(job.id);
        return {
          ...job,
          companyId: job.companyId ?? undefined,
          companyWebsite: job.companyWebsite ?? undefined,
          logoUrl: job.logoUrl ?? undefined,
          logoSource: job.logoSource ?? undefined,
          health: job.health ?? undefined,
          addedAt: iso(job.addedAt),
          sample: job.sample || undefined,
          stage: app?.stage || "Saved",
          notes: app?.notes || "",
          channel: app?.channel ?? undefined,
          appliedAt: app?.appliedAt ? iso(app.appliedAt) : undefined,
          followUp: app?.followUp ?? undefined,
        };
      }),
      drafts: draftRows
        .map(({ workspaceId, updatedAt, ...draft }) => ({
          ...draft,
          createdAt: iso(draft.createdAt),
        }))
        .reverse(),
      activity: activityRows.map(({ workspaceId, position, ...entry }) => ({
        ...entry,
        at: iso(entry.at),
      })),
      ...(discoveryRows.length
        ? {
            discovery: {
              checkedAt: iso(discoveryRows[0].checkedAt),
              sources: discoveryRows.map(({ workspaceId, ...row }) => ({
                ...row,
                source: row.source as DiscoverySource["source"],
                checkedAt: iso(row.checkedAt),
              })),
            },
          }
        : {}),
      ...(meta[0]?.lastDiscovery
        ? { lastDiscovery: iso(meta[0].lastDiscovery) }
        : {}),
    };
  }
  async function persist(tx: Database, next: Workspace, before?: Workspace) {
    const now = new Date().toISOString();
    const exclusions = next.employerExclusions || [];
    const removedExclusions = (before?.employerExclusions || [])
      .filter((e) => !exclusions.some((n) => n.key === e.key))
      .map((e) => e.key);
    if (removedExclusions.length)
      await tx
        .delete(s.employerExclusions)
        .where(
          and(
            eq(s.employerExclusions.workspaceId, workspaceId),
            inArray(s.employerExclusions.key, removedExclusions),
          ),
        );
    for (const exclusion of exclusions) {
      if (
        same(
          exclusion,
          before?.employerExclusions?.find((e) => e.key === exclusion.key),
        )
      )
        continue;
      const row = { ...exclusion, workspaceId };
      await tx
        .insert(s.employerExclusions)
        .values(row)
        .onConflictDoUpdate({
          target: [s.employerExclusions.workspaceId, s.employerExclusions.key],
          set: row,
        });
    }
    const { projects: projectList, resume, ...profile } = next.profile;
    const oldProfile = before?.profile;
    if (
      !oldProfile ||
      !same(profile, (({ projects, resume, ...p }) => p)(oldProfile))
    )
      await tx
        .insert(s.profiles)
        .values({ workspaceId, ...profile, updatedAt: now })
        .onConflictDoUpdate({
          target: s.profiles.workspaceId,
          set: { ...profile, updatedAt: now },
        });
    const removedProjects =
      before?.profile.projects
        .filter((p) => !projectList.some((n) => n.id === p.id))
        .map((p) => p.id) || [];
    if (removedProjects.length)
      await tx
        .delete(s.projects)
        .where(
          and(
            eq(s.projects.workspaceId, workspaceId),
            inArray(s.projects.id, removedProjects),
          ),
        );
    for (const [position, p] of projectList.entries()) {
      if (
        before?.profile.projects[position]?.id === p.id &&
        same(before.profile.projects[position], p)
      )
        continue;
      const row = {
        ...p,
        workspaceId,
        position,
        githubUrl: p.githubUrl || null,
        websiteUrl: p.websiteUrl || null,
        repositoryCandidates: p.repositoryCandidates?.length
          ? p.repositoryCandidates
          : null,
        buildMode: p.buildMode || null,
        contribution: p.contribution || null,
        importedAt: p.importedAt || null,
        updatedAt: now,
      };
      await tx
        .insert(s.projects)
        .values(row)
        .onConflictDoUpdate({
          target: [s.projects.workspaceId, s.projects.id],
          set: row,
        });
    }
    if (!same(resume, before?.profile.resume)) {
      await tx
        .update(s.resumes)
        .set({ active: false })
        .where(
          and(
            eq(s.resumes.workspaceId, workspaceId),
            eq(s.resumes.active, true),
          ),
        );
      if (resume?.id) {
        const saved = await tx
          .update(s.resumes)
          .set({ active: true })
          .where(
            and(
              eq(s.resumes.workspaceId, workspaceId),
              eq(s.resumes.id, resume.id),
              eq(s.resumes.status, "ready"),
            ),
          )
          .returning({ id: s.resumes.id });
        if (!saved.length)
          throw new Error(
            "This résumé import is not available in your workspace. Please upload it again.",
          );
      } else if (resume) {
        await tx.insert(s.resumes).values({
          workspaceId,
          filename: resume.name,
          extractedText: resume.text,
          status: "ready",
          active: true,
          uploadedAt: resume.uploadedAt,
        });
      }
    }
    const removedCompanies =
      before?.companies
        .filter((p) => !next.companies.some((n) => n.id === p.id))
        .map((p) => p.id) || [];
    if (removedCompanies.length)
      await tx
        .delete(s.companies)
        .where(
          and(
            eq(s.companies.workspaceId, workspaceId),
            inArray(s.companies.id, removedCompanies),
          ),
        );
    for (const [position, c] of next.companies.entries()) {
      const old = before?.companies[position];
      if (old?.id === c.id && same(old, c)) continue;
      const { people, ...company } = c;
      const row = {
        ...company,
        logoUrl: company.logoUrl || null,
        logoSource: company.logoSource || null,
        workspaceId,
        position,
        updatedAt: now,
      };
      await tx
        .insert(s.companies)
        .values(row)
        .onConflictDoUpdate({
          target: [s.companies.workspaceId, s.companies.id],
          set: row,
        });
      if (!same(people, old?.people)) {
        await tx
          .delete(s.companyPeople)
          .where(
            and(
              eq(s.companyPeople.workspaceId, workspaceId),
              eq(s.companyPeople.companyId, c.id),
            ),
          );
        if (people.length)
          await tx.insert(s.companyPeople).values(
            people.map((p, position) => ({
              ...p,
              workspaceId,
              companyId: c.id,
              position,
            })),
          );
      }
    }
    const removedJobs =
      before?.jobs
        .filter((p) => !next.jobs.some((n) => n.id === p.id))
        .map((p) => p.id) || [];
    if (removedJobs.length)
      await tx
        .delete(s.jobs)
        .where(
          and(
            eq(s.jobs.workspaceId, workspaceId),
            inArray(s.jobs.id, removedJobs),
          ),
        );
    for (const [position, j] of next.jobs.entries()) {
      const old = before?.jobs[position];
      if (old?.id === j.id && same(old, j)) continue;
      const { stage, channel, appliedAt, followUp, notes, ...job } = j;
      const row = {
        ...job,
        companyId: job.companyId || null,
        companyWebsite: job.companyWebsite || null,
        logoUrl: job.logoUrl || null,
        logoSource: job.logoSource || null,
        health: job.health || null,
        workspaceId,
        position,
        sample: j.sample || false,
      };
      await tx
        .insert(s.jobs)
        .values(row)
        .onConflictDoUpdate({
          target: [s.jobs.workspaceId, s.jobs.id],
          set: row,
        });
      const app = {
        workspaceId,
        jobId: j.id,
        stage,
        channel: channel || null,
        appliedAt: appliedAt || null,
        followUp: followUp || null,
        notes,
        updatedAt: now,
      };
      await tx
        .insert(s.applications)
        .values(app)
        .onConflictDoUpdate({
          target: [s.applications.workspaceId, s.applications.jobId],
          set: app,
        });
    }
    for (const d of next.drafts) {
      if (
        same(
          before?.drafts.find((p) => p.id === d.id),
          d,
        )
      )
        continue;
      const row = { ...d, workspaceId, updatedAt: now };
      await tx
        .insert(s.drafts)
        .values(row)
        .onConflictDoUpdate({
          target: [s.drafts.workspaceId, s.drafts.id],
          set: row,
        });
    }
    const removedDrafts =
      before?.drafts
        .filter((p) => !next.drafts.some((n) => n.id === p.id))
        .map((p) => p.id) || [];
    if (removedDrafts.length)
      await tx
        .delete(s.drafts)
        .where(
          and(
            eq(s.drafts.workspaceId, workspaceId),
            inArray(s.drafts.id, removedDrafts),
          ),
        );
    const removedActivity =
      before?.activity
        .filter((p) => !next.activity.some((n) => n.id === p.id))
        .map((p) => p.id) || [];
    if (removedActivity.length)
      await tx
        .delete(s.activity)
        .where(
          and(
            eq(s.activity.workspaceId, workspaceId),
            inArray(s.activity.id, removedActivity),
          ),
        );
    for (const [position, a] of next.activity.entries()) {
      if (same(before?.activity[position], a)) continue;
      const row = { ...a, workspaceId, position };
      await tx
        .insert(s.activity)
        .values(row)
        .onConflictDoUpdate({
          target: [s.activity.workspaceId, s.activity.id],
          set: row,
        });
    }
    if (next.discovery && !same(next.discovery, before?.discovery)) {
      for (const source of next.discovery.sources) {
        const row = { ...source, workspaceId };
        await tx
          .insert(s.discoverySources)
          .values(row)
          .onConflictDoUpdate({
            target: [s.discoverySources.workspaceId, s.discoverySources.source],
            set: row,
          });
      }
    }
    await tx
      .update(s.workspaces)
      .set({ lastDiscovery: next.lastDiscovery || null, updatedAt: now })
      .where(eq(s.workspaces.id, workspaceId));
  }
  async function initialize(tx: Database) {
    await tx.insert(s.users).values({ id: workspaceId }).onConflictDoNothing();
    const inserted = await tx
      .insert(s.workspaces)
      .values({ id: workspaceId, ownerId: workspaceId })
      .onConflictDoNothing()
      .returning({ id: s.workspaces.id });
    // A database row lock serializes writes even across multiple server processes.
    await tx
      .select({ id: s.workspaces.id })
      .from(s.workspaces)
      .where(eq(s.workspaces.id, workspaceId))
      .for("update");
    if (inserted.length) await persist(tx, initialWorkspace());
  }
  return {
    async getWorkspace() {
      return db.transaction(async (tx) => {
        await initialize(tx);
        return load(tx);
      });
    },
    async updateWorkspace(change: (workspace: Workspace) => void) {
      return db.transaction(async (tx) => {
        await initialize(tx);
        const before = await load(tx);
        const next = structuredClone(before);
        change(next);
        await persist(tx, next, before);
        return load(tx);
      });
    },
    async importLegacy(legacy: Workspace) {
      return db.transaction(async (tx) => {
        await initialize(tx);
        const [meta] = await tx
          .select()
          .from(s.workspaces)
          .where(eq(s.workspaces.id, workspaceId));
        if (meta.legacyImportedAt)
          return { imported: false, workspace: await load(tx) };
        const before = await load(tx);
        if (
          before.profile.name ||
          before.profile.resume ||
          before.jobs.some((j) => !j.sample) ||
          before.drafts.length ||
          before.activity.length
        )
          throw new Error(
            "The database workspace already contains user data. Legacy import stopped to avoid replacing it.",
          );
        await persist(tx, legacy, before);
        const migrated = await load(tx);
        if (!sameLegacyFacts(legacy, migrated))
          throw new Error(
            "Legacy import verification failed; the transaction was rolled back.",
          );
        await tx
          .update(s.workspaces)
          .set({ legacyImportedAt: new Date().toISOString() })
          .where(eq(s.workspaces.id, workspaceId));
        return { imported: true, workspace: await load(tx) };
      });
    },
    async getResumeFile(id: string) {
      const [row] = await db
        .select({
          filename: s.resumes.filename,
          content: s.resumes.content,
          contentType: s.resumes.contentType,
        })
        .from(s.resumes)
        .where(
          and(eq(s.resumes.workspaceId, workspaceId), eq(s.resumes.id, id)),
        );
      return row;
    },
    async saveResume(input: {
      filename: string;
      content: Buffer;
      contentType: string;
      text: string;
      fields: Partial<import("../lib/resume").ResumeFields>;
      model: string;
    }) {
      return db.transaction(async (tx) => {
        await initialize(tx);
        const [row] = await tx
          .insert(s.resumes)
          .values({
            workspaceId,
            filename: input.filename,
            content: input.content,
            contentType: input.contentType,
            sizeBytes: input.content.length,
            extractedText: input.text,
            extractedFields: input.fields,
            model: input.model,
            status: "ready",
          })
          .returning({ id: s.resumes.id });
        return row.id;
      });
    },
  };
}
