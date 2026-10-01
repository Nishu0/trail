import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as s from "./schema";
import type {
  LinkedInTuningState,
  LinkedInSection,
  ProfileReview,
  ResearchInsight,
  Revision,
} from "../lib/linkedin-types";
export function createLinkedInRepository(
  db: PgDatabase<any, typeof s>,
  workspaceId: string,
) {
  const scope = (table: { workspaceId: any }) =>
    eq(table.workspaceId, workspaceId);
  async function init() {
    await db
      .insert(s.linkedInProfiles)
      .values({ workspaceId })
      .onConflictDoNothing();
  }
  async function getResearch(client: PgDatabase<any, typeof s> = db) {
    const [run] = await client
      .select()
      .from(s.linkedInResearchRuns)
      .where(
        and(
          scope(s.linkedInResearchRuns),
          eq(s.linkedInResearchRuns.status, "complete"),
        ),
      )
      .orderBy(desc(s.linkedInResearchRuns.startedAt))
      .limit(1);
    if (!run) return { run: null, profiles: [] as ProfileReview[] };
    const rows = await client
      .select()
      .from(s.linkedInResearchProfiles)
      .where(
        and(
          scope(s.linkedInResearchProfiles),
          eq(s.linkedInResearchProfiles.runId, run.id),
        ),
      )
      .orderBy(s.linkedInResearchProfiles.position);
    return {
      run,
      profiles: rows.map(({ workspaceId, runId, position, ...row }) => row),
    };
  }
  async function getState(): Promise<LinkedInTuningState> {
    await init();
    return db.transaction(
      async (tx) => {
        const [[profile], sections, messages, revisions, research] =
          await Promise.all([
            tx
              .select()
              .from(s.linkedInProfiles)
              .where(scope(s.linkedInProfiles)),
            tx
              .select()
              .from(s.linkedInSections)
              .where(scope(s.linkedInSections))
              .orderBy(s.linkedInSections.position),
            tx
              .select()
              .from(s.linkedInMessages)
              .where(scope(s.linkedInMessages))
              .orderBy(desc(s.linkedInMessages.sequence))
              .limit(40),
            tx
              .select()
              .from(s.linkedInRevisions)
              .where(scope(s.linkedInRevisions))
              .orderBy(desc(s.linkedInRevisions.createdAt))
              .limit(100),
            getResearch(tx),
          ]);
        return {
          profileUrl: profile.profileUrl,
          lastCheckedAt: profile.lastCheckedAt,
          syncStatus: profile.syncStatus,
          syncNote: profile.syncNote,
          sections: sections.map(({ workspaceId, position, ...section }) => ({
            ...section,
            kind: section.kind as LinkedInSection["kind"],
          })),
          messages: messages.reverse().map(({ workspaceId, ...message }) => ({
            ...message,
            role: message.role as "user" | "assistant",
            revisions: revisions
              .filter((r) => r.messageId === message.id)
              .map(({ workspaceId, messageId, ...r }) => r),
          })),
          research: research.run,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async function saveUrl(profileUrl: string) {
    await init();
    await db
      .update(s.linkedInProfiles)
      .set({
        profileUrl,
        updatedAt: new Date().toISOString(),
        syncStatus: "not_checked",
        syncNote:
          "Profile link saved. Refresh the public source or paste your current sections.",
      })
      .where(scope(s.linkedInProfiles));
  }
  async function saveSection(
    input: Omit<LinkedInSection, "version" | "source" | "updatedAt">,
    expectedVersion?: number,
    source = "manual",
  ) {
    await init();
    await db.transaction(async (tx) => {
      await tx
        .select()
        .from(s.linkedInProfiles)
        .where(scope(s.linkedInProfiles))
        .for("update");
      const [old] = await tx
        .select()
        .from(s.linkedInSections)
        .where(
          and(scope(s.linkedInSections), eq(s.linkedInSections.id, input.id)),
        );
      if (
        old &&
        expectedVersion !== undefined &&
        old.version !== expectedVersion
      )
        throw new Error(
          "This section changed. Reload before saving your edits.",
        );
      const rows = await tx
        .select({ id: s.linkedInSections.id })
        .from(s.linkedInSections)
        .where(scope(s.linkedInSections));
      if (!old && rows.length >= 20)
        throw new Error("You can keep up to 20 profile sections.");
      const row = {
        ...input,
        workspaceId,
        position: old?.position ?? rows.length,
        version: (old?.version || 0) + 1,
        source,
        updatedAt: new Date().toISOString(),
      };
      await tx
        .insert(s.linkedInSections)
        .values(row)
        .onConflictDoUpdate({
          target: [s.linkedInSections.workspaceId, s.linkedInSections.id],
          set: row,
        });
      await tx.insert(s.linkedInSnapshots).values({
        workspaceId,
        profileUrl: (
          await tx
            .select()
            .from(s.linkedInProfiles)
            .where(scope(s.linkedInProfiles))
        )[0].profileUrl,
        source,
        status: "confirmed",
        text: input.currentText,
        note: `Current text saved for ${input.label}`,
      });
    });
  }
  async function saveSync(
    profileUrl: string,
    status: string,
    text: string,
    note: string,
  ) {
    await init();
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(s.linkedInProfiles)
        .where(scope(s.linkedInProfiles))
        .for("update");
      if (current.profileUrl !== profileUrl)
        throw new Error("The profile link changed during refresh. Try again.");
      const now = new Date().toISOString();
      await tx
        .update(s.linkedInProfiles)
        .set({
          lastCheckedAt: now,
          syncStatus: status,
          syncNote: note,
          updatedAt: now,
        })
        .where(scope(s.linkedInProfiles));
      await tx.insert(s.linkedInSnapshots).values({
        workspaceId,
        profileUrl,
        source: "public_index",
        status,
        text,
        note,
        checkedAt: now,
      });
    });
  }
  async function getLatestSnapshot() {
    const [row] = await db
      .select()
      .from(s.linkedInSnapshots)
      .where(
        and(
          scope(s.linkedInSnapshots),
          eq(s.linkedInSnapshots.source, "public_index"),
        ),
      )
      .orderBy(desc(s.linkedInSnapshots.checkedAt))
      .limit(1);
    return row || null;
  }
  async function addMessage(
    role: "user" | "assistant",
    content: string,
    sectionId?: string,
  ) {
    await init();
    const id = crypto.randomUUID();
    await db
      .insert(s.linkedInMessages)
      .values({ workspaceId, id, role, content, sectionId });
    return id;
  }
  async function addAssistant(
    content: string,
    revisions: Omit<Revision, "id" | "status" | "createdAt">[],
    sectionId?: string,
  ) {
    await init();
    await db.transaction(async (tx) => {
      const id = crypto.randomUUID();
      await tx
        .insert(s.linkedInMessages)
        .values({ workspaceId, id, role: "assistant", content, sectionId });
      if (revisions.length)
        await tx.insert(s.linkedInRevisions).values(
          revisions.map((revision) => ({
            ...revision,
            workspaceId,
            messageId: id,
            id: crypto.randomUUID(),
          })),
        );
    });
  }
  async function confirmRevision(id: string) {
    await db.transaction(async (tx) => {
      await tx
        .select()
        .from(s.linkedInProfiles)
        .where(scope(s.linkedInProfiles))
        .for("update");
      const [revision] = await tx
        .select()
        .from(s.linkedInRevisions)
        .where(and(scope(s.linkedInRevisions), eq(s.linkedInRevisions.id, id)));
      if (!revision) throw new Error("Revision not found.");
      if (revision.status === "published")
        throw new Error("This revision is already recorded as published.");
      const [section] = await tx
        .select()
        .from(s.linkedInSections)
        .where(
          and(
            scope(s.linkedInSections),
            eq(s.linkedInSections.id, revision.sectionId),
          ),
        );
      if (
        !section ||
        section.currentText !== revision.beforeText ||
        section.version !== revision.baseVersion
      )
        throw new Error(
          "Your current section changed. Generate a new revision before recording this update.",
        );
      await tx
        .update(s.linkedInSections)
        .set({
          currentText: revision.afterText,
          version: section.version + 1,
          source: "user_confirmed",
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(scope(s.linkedInSections), eq(s.linkedInSections.id, section.id)),
        );
      await tx
        .update(s.linkedInRevisions)
        .set({ status: "published" })
        .where(and(scope(s.linkedInRevisions), eq(s.linkedInRevisions.id, id)));
      const [profile] = await tx
        .select()
        .from(s.linkedInProfiles)
        .where(scope(s.linkedInProfiles));
      await tx.insert(s.linkedInSnapshots).values({
        workspaceId,
        profileUrl: profile.profileUrl,
        source: "user_confirmed",
        status: "confirmed",
        text: revision.afterText,
        note: `User confirmed LinkedIn was updated: ${section.label}`,
      });
    });
  }
  async function saveResearch(
    profiles: ProfileReview[],
    insights: ResearchInsight[],
    methodology: string,
  ) {
    if (
      new Set(profiles.map((p) => p.url)).size !== profiles.length ||
      profiles.length < 100
    )
      throw new Error(
        "A complete benchmark needs at least 100 unique reviewed profiles.",
      );
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(s.linkedInResearchRuns).values({
        workspaceId,
        id,
        status: "complete",
        requestedCount: 100,
        reviewedCount: profiles.length,
        methodology,
        insights,
        completedAt: new Date().toISOString(),
      });
      await tx.insert(s.linkedInResearchProfiles).values(
        profiles.map((p, position) => ({
          ...p,
          workspaceId,
          runId: id,
          position,
        })),
      );
    });
    return id;
  }
  return {
    getState,
    getResearch,
    saveUrl,
    saveSection,
    saveSync,
    getLatestSnapshot,
    addMessage,
    addAssistant,
    confirmRevision,
    saveResearch,
  };
}
