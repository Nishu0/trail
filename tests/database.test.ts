import { beforeAll, afterAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, and } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { createWorkspaceRepository } from "../src/db/workspace-repository";
import {
  testCompany,
  testJob,
  testEmployerExclusion,
} from "./fixtures/workspace";
import { initialWorkspace } from "../src/lib/model";
const postgres = new PGlite();
const db = drizzle(postgres, { schema });
const repository = () => createWorkspaceRepository(db, crypto.randomUUID());
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(async () => {
  await postgres.close();
});
test("source checks, archived history, and company logo provenance survive a SQL reload", async () => {
  const repo = repository();
  await repo.getWorkspace();
  const checkedAt = new Date().toISOString();
  await repo.updateWorkspace((w) => {
    w.companies.push({
      ...testCompany,
      logoUrl: "https://example.com/logo.png",
      logoSource: "https://example.com",
    });
    w.jobs.push({
      ...testJob,
      companyId: testCompany.id,
      sample: false,
      stage: "Archived",
      logoUrl: "https://example.com/logo.png",
      logoSource: "https://example.com",
      companyWebsite: "https://example.com",
      health: {
        status: "closed",
        checkedAt,
        url: testJob.url,
        reason: "Listing removed",
        previousStage: "Applied",
      },
    });
  });
  const saved = await repo.getWorkspace();
  expect(saved.jobs[0].health?.previousStage).toBe("Applied");
  expect(saved.jobs[0].stage).toBe("Archived");
  expect(saved.companies[0].logoUrl).toBe("https://example.com/logo.png");
  expect(saved.jobs[0].logoSource).toBe("https://example.com");
});
test("SQL schema initializes empty once and concurrent transactions retain all mutations", async () => {
  const repo = repository();
  const reads = await Promise.all([
    repo.getWorkspace(),
    repo.getWorkspace(),
    repo.getWorkspace(),
  ]);
  expect(
    reads.every((w) => w.jobs.length === 0 && w.companies.length === 0),
  ).toBe(true);
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      repo.updateWorkspace((w) => {
        w.activity.push({
          id: String(i),
          text: "Concurrent database mutation",
          at: new Date().toISOString(),
        });
      }),
    ),
  );
  const saved = await repo.getWorkspace();
  expect(saved.activity.length).toBe(10);
});
test("employer exclusions survive reload and remain scoped to their workspace", async () => {
  const a = repository(),
    b = repository();
  await a.getWorkspace();
  await b.getWorkspace();
  await a.updateWorkspace((w) => {
    w.employerExclusions = [structuredClone(testEmployerExclusion)];
  });
  expect((await a.getWorkspace()).employerExclusions).toEqual([
    testEmployerExclusion,
  ]);
  expect((await b.getWorkspace()).employerExclusions).toBeUndefined();
  await b.updateWorkspace((w) => {
    w.employerExclusions = [
      { ...testEmployerExclusion, reason: "Other workspace preference" },
    ];
  });
  await a.updateWorkspace((w) => {
    w.employerExclusions![0].aliases.push("Hire Feed Jobs");
  });
  expect((await a.getWorkspace()).employerExclusions![0].aliases).toContain(
    "Hire Feed Jobs",
  );
  expect((await b.getWorkspace()).employerExclusions![0].aliases).not.toContain(
    "Hire Feed Jobs",
  );
  await a.updateWorkspace((w) => {
    delete w.employerExclusions;
  });
  expect((await a.getWorkspace()).employerExclusions).toBeUndefined();
  expect((await b.getWorkspace()).employerExclusions![0].reason).toBe(
    "Other workspace preference",
  );
});
test("normalized profile, projects, résumé file, company people, applications and drafts round-trip", async () => {
  const repo = repository();
  await repo.getWorkspace();
  const resumeId = await repo.saveResume({
    filename: "sample.pdf",
    content: Buffer.from("%PDF-test bytes"),
    contentType: "application/pdf",
    text: "Sample résumé facts",
    fields: { name: "Alex" },
    model: "test",
  });
  const now = new Date().toISOString();
  await repo.updateWorkspace((w) => {
    w.profile = {
      ...w.profile,
      name: "Alex",
      bio: "I build developer tools.",
      skills: "TypeScript, React",
      writing: "My own words",
      resume: {
        id: resumeId,
        name: "sample.pdf",
        text: "Sample résumé facts",
        uploadedAt: now,
      },
      projects: [
        {
          id: "project-1",
          name: "Notes",
          platform: "GitHub",
          url: "https://example.com",
          description: "Collaborative notes",
          stack: "TypeScript",
          websiteUrl: "https://notes.example.com",
          repositoryCandidates: [
            "https://github.com/alex/notes",
            "https://github.com/alex/notes-api",
          ],
          buildMode: "team",
          contribution: "I built the editor.",
        },
      ],
    };
    w.companies.push(structuredClone(testCompany));
    w.companies[0].people = [
      {
        name: "A founder",
        role: "Founder",
        linkedin: "https://linkedin.com/in/example",
        x: "https://x.com/example",
        evidence: "https://example.com/team",
      },
    ];
    w.jobs.unshift({
      ...testJob,
      id: "real-job",
      url: "https://example.com/jobs/1",
      sample: false,
      stage: "Applied",
      channel: "Email",
      appliedAt: now,
      followUp: "2026-10-13",
      notes: "Specific detail",
    });
    w.drafts.unshift({
      id: "draft-1",
      jobId: "real-job",
      subject: "Hello",
      body: "Personal draft",
      mode: "starter",
      createdAt: now,
    });
  });
  const saved = await repo.getWorkspace();
  expect(saved.profile.name).toBe("Alex");
  expect(saved.profile.projects[0].repositoryCandidates).toHaveLength(2);
  expect(saved.profile.projects[0].websiteUrl).toBe(
    "https://notes.example.com",
  );
  expect(saved.profile.resume?.id).toBe(resumeId);
  expect(saved.profile.projects[0].contribution).toBe("I built the editor.");
  expect(saved.jobs[0].followUp).toBe("2026-10-13");
  expect(saved.drafts[0].body).toBe("Personal draft");
  expect(saved.companies[0].people[0].evidence).toBe(
    "https://example.com/team",
  );
  const [file] = await db
    .select()
    .from(schema.resumes)
    .where(eq(schema.resumes.id, resumeId));
  expect(Buffer.from(file.content!).toString()).toBe("%PDF-test bytes");
  expect(file.active).toBe(true);
  await repo.updateWorkspace((w) => {
    delete w.profile.resume;
    w.profile.projects = [];
  });
  expect((await repo.getWorkspace()).profile.projects).toHaveLength(0);
  expect((await repo.getWorkspace()).profile.resume).toBeUndefined();
  expect(
    (
      await db
        .select()
        .from(schema.resumes)
        .where(eq(schema.resumes.id, resumeId))
    )[0].active,
  ).toBe(false);
});
test("SQL constraints roll back the entire mutation on invalid references or duplicate source URLs", async () => {
  const repo = repository();
  const baseline = await repo.getWorkspace();
  await expect(
    repo.updateWorkspace((w) => {
      w.profile.name = "Should roll back";
      w.drafts.push({
        id: "bad",
        jobId: "missing",
        subject: "",
        body: "",
        mode: "starter",
        createdAt: new Date().toISOString(),
      });
    }),
  ).rejects.toThrow();
  expect((await repo.getWorkspace()).profile.name).toBe(baseline.profile.name);
  await expect(
    repo.updateWorkspace((w) => {
      const job = {
        ...testJob,
        sample: false,
        url: "https://example.com/same",
      };
      w.jobs.push({ ...job, id: "a" }, { ...job, id: "b" });
    }),
  ).rejects.toThrow();
  expect((await repo.getWorkspace()).jobs.length).toBe(0);
});
test("workspace scope isolates profiles and prevents using another workspace's résumé", async () => {
  const a = repository(),
    b = repository();
  await a.getWorkspace();
  await b.getWorkspace();
  const id = await a.saveResume({
    filename: "private.txt",
    content: Buffer.from("Private facts"),
    contentType: "text/plain",
    text: "Private facts",
    fields: {},
    model: "test",
  });
  await a.updateWorkspace((w) => {
    w.profile.name = "Workspace A";
  });
  expect((await b.getWorkspace()).profile.name).toBe("");
  await expect(
    b.updateWorkspace((w) => {
      w.profile.resume = {
        id,
        name: "private.txt",
        text: "Private facts",
        uploadedAt: new Date().toISOString(),
      };
    }),
  ).rejects.toThrow("not available");
});
test("legacy import preserves facts, runs once, and refuses to overwrite a used workspace", async () => {
  const repo = repository();
  const old = initialWorkspace();
  old.profile.name = "Legacy Builder";
  old.profile.resume = {
    name: "legacy.pdf",
    text: "Historical résumé",
    uploadedAt: new Date().toISOString(),
  };
  expect((await repo.importLegacy(old)).imported).toBe(true);
  expect((await repo.importLegacy(old)).imported).toBe(false);
  expect((await repo.getWorkspace()).profile.resume?.text).toBe(
    "Historical résumé",
  );
  const used = repository();
  await used.updateWorkspace((w) => {
    w.profile.name = "Existing person";
  });
  await expect(used.importLegacy(old)).rejects.toThrow(
    "already contains user data",
  );
  expect((await used.getWorkspace()).profile.name).toBe("Existing person");
});

test("discovery reports and company-linked opportunities persist, remain scoped, and reject cross-workspace links", async () => {
  const a = repository(),
    b = repository();
  const now = new Date().toISOString();
  await a.updateWorkspace((w) => {
    w.companies.push(structuredClone(testCompany));
    w.jobs.push({ ...testJob, id: "linked", companyId: testCompany.id });
    w.discovery = {
      checkedAt: now,
      sources: [
        {
          source: "X",
          status: "complete",
          checked: 20,
          matched: 3,
          imported: 3,
          query: "Rust",
          checkedAt: now,
          message: "Live posts",
        },
        {
          source: "LinkedIn",
          status: "unavailable",
          checked: 0,
          matched: 0,
          imported: 0,
          query: "Rust",
          checkedAt: now,
          message: "Rate limited",
        },
      ],
    };
  });
  const saved = await a.getWorkspace();
  expect(saved.jobs[0].companyId).toBe(testCompany.id);
  expect(
    saved.discovery?.sources.find((source) => source.source === "X")?.imported,
  ).toBe(3);
  expect(
    saved.discovery?.sources.find((source) => source.source === "LinkedIn")
      ?.status,
  ).toBe("unavailable");
  expect((await b.getWorkspace()).discovery).toBeUndefined();
  await expect(
    b.updateWorkspace((w) => {
      w.jobs.push({ ...testJob, companyId: testCompany.id });
    }),
  ).rejects.toThrow();
  expect((await b.getWorkspace()).jobs).toHaveLength(0);
  await a.updateWorkspace((w) => {
    delete w.jobs[0].companyId;
  });
  expect((await a.getWorkspace()).jobs[0].companyId).toBeUndefined();
});
