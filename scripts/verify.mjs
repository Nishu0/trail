import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { readResumeResponse } from "../src/lib/resume-progress.ts";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema.ts";
const postgres = await PGlite.create();
await migrate(drizzle(postgres, { schema }), { migrationsFolder: "./drizzle" });
const socket = new PGLiteSocketServer({
  db: postgres,
  host: "127.0.0.1",
  port: 54321,
});
await socket.start();
const workspaceId = crypto.randomUUID();
const server = spawn("bun", ["run", "start", "-p", "3011"], {
  env: {
    ...process.env,
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54321/postgres",
    TRAIL_WORKSPACE_ID: workspaceId,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (d) => (output += d));
server.stderr.on("data", (d) => (output += d));
const base = "http://127.0.0.1:3011";
async function api(route, method = "GET", body) {
  const r = await fetch(base + route, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    console.log(
      output
        .split("\n")
        .filter((line) => line.includes("linkedin_storage_read_failed"))
        .join("\n"),
    );
    throw new Error(`${route}: ${r.status} ${JSON.stringify(data)}`);
  }
  return data;
}
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(base + "/api/workspace");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(ready, output);
  const baseline = await api("/api/workspace");
  assert.equal(baseline.jobs.length, 0);
  assert.equal(baseline.companies.length, 0);
  const health = await api("/api/jobs/check", "POST", {});
  assert.equal(health.checked, 0);
  assert.equal(health.archived, 0);
  const logoUrl = "https://assets.example.org/verified-logo.svg";
  const logoBytes = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="orange"/></svg>',
  );
  await drizzle(postgres, { schema })
    .insert(schema.brandAssets)
    .values({ url: logoUrl, content: logoBytes, contentType: "image/svg+xml" });
  const image = await fetch(
    base + `/api/brand?url=${encodeURIComponent(logoUrl)}`,
  );
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/svg+xml");
  assert(image.headers.get("content-security-policy").includes("sandbox"));
  assert.equal(
    Buffer.from(await image.arrayBuffer()).toString(),
    logoBytes.toString(),
  );
  assert.equal(
    (await fetch(base + "/api/brand?url=https://127.0.0.1/logo.png")).status,
    404,
  );
  console.log(
    "Job-check API and stored brand image → safe HTTP response passed.",
  );
  // Résumé imports remain previews until the user applies and saves the fields.
  let resumePreview;
  for (const extension of ["txt", "pdf", "docx"]) {
    const form = new FormData();
    const file = await readFile(
      new URL(`../tests/fixtures/resume.${extension}`, import.meta.url),
    );
    form.set("file", new File([file], `resume.${extension}`));
    form.set("useAI", "false");
    const response = await fetch(base + "/api/resume", {
      method: "POST",
      body: form,
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.fields.name, "Alex Builder");
    assert(
      result.projectLinks.includes("https://github.com/alex-builder/notes"),
    );
    assert(
      result.projects.some(
        (p) => p.githubUrl === "https://github.com/alex-builder/notes",
      ),
    );
    resumePreview = result;
  }
  assert.equal(
    (await api("/api/workspace")).profile.name,
    baseline.profile.name,
  );
  const streamedResume = new FormData();
  streamedResume.set(
    "file",
    new File(
      [
        await readFile(
          new URL("../tests/fixtures/resume.txt", import.meta.url),
        ),
      ],
      "resume.txt",
    ),
  );
  streamedResume.set("useAI", "false");
  const stages = [];
  const streamedResponse = await fetch(base + "/api/resume", {
    method: "POST",
    headers: { Accept: "application/x-ndjson" },
    body: streamedResume,
  });
  const streamedResult = await readResumeResponse(streamedResponse, (stage) =>
    stages.push(stage),
  );
  assert.deepEqual(stages, ["reading", "matching", "projects", "preparing"]);
  assert.equal(streamedResult.fields.name, "Alex Builder");
  const unreadable = new FormData();
  unreadable.set("file", new File(["invalid pdf contents"], "resume.pdf"));
  const failedResponse = await fetch(base + "/api/resume", {
    method: "POST",
    headers: { Accept: "application/x-ndjson" },
    body: unreadable,
  });
  await assert.rejects(
    readResumeResponse(failedResponse, () => {}),
    /file contents must match/,
  );
  const unsafeProject = await fetch(base + "/api/project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://127.0.0.1/" }),
  });
  assert.equal(unsafeProject.status, 400);
  const profile = {
    ...baseline.profile,
    name: "Trail QA",
    bio: "I ship small developer tools.",
    skills: "TypeScript, React",
    target: "engineer",
    resume: {
      id: resumePreview.resumeId,
      fileStored: true,
      name: resumePreview.filename,
      text: resumePreview.text,
      uploadedAt: new Date().toISOString(),
    },
    projects: [
      {
        id: "test-project",
        name: "Notes",
        platform: "GitHub",
        url: "https://example.com/notes",
        description: "Built an offline notes app from end to end.",
        stack: "TypeScript",
        buildMode: "team",
        contribution:
          "I built the editor UI. My teammate built the sync engine.",
        websiteUrl: "https://example.com/notes",
        githubUrl: "https://github.com/alex-builder/notes",
      },
    ],
  };
  await api("/api/workspace", "PATCH", { action: "profile", profile });
  let w = await api("/api/workspace", "PATCH", {
    action: "add-job",
    job: {
      company: "QA Team",
      role: "Product engineer",
      source: "X",
      url: "https://example.com/jobs/qa",
      location: "Remote",
      description: "Build developer tools with TypeScript.",
      tags: ["TypeScript"],
      notes: "I like the local-first product direction.",
    },
  });
  const job = w.jobs.find((j) => !j.sample);
  assert(job);
  w = await api("/api/workspace", "PATCH", {
    action: "job",
    id: job.id,
    stage: "Applied",
    channel: "Email",
    followUp: "2026-10-09",
    notes: job.notes,
  });
  assert(w.jobs.find((j) => j.id === job.id).appliedAt);
  const drafted = await api("/api/draft", "POST", {
    jobId: job.id,
    useAI: false,
  });
  assert(drafted.draft.body.includes("Notes"));
  assert(drafted.draft.body.includes("I worked with a team"));
  assert(drafted.draft.body.includes("I built the editor UI"));
  assert(drafted.draft.body.includes("local-first"));
  await api("/api/workspace", "PATCH", {
    action: "draft",
    id: drafted.draft.id,
    subject: "A personal hello",
    body: "An edited draft, saved.",
  });
  const reloaded = await api("/api/workspace");
  assert.equal(reloaded.profile.name, "Trail QA");
  assert.equal(reloaded.profile.resume.name, "resume.docx");
  assert.equal(reloaded.profile.projects[0].buildMode, "team");
  assert.equal(reloaded.drafts[0].body, "An edited draft, saved.");
  assert.equal(reloaded.jobs.find((j) => j.id === job.id).channel, "Email");
  const sqlDraft = await postgres.query(
    "select subject from trail_drafts where workspace_id = $1 and id = $2",
    [workspaceId, drafted.draft.id],
  );
  assert.equal(sqlDraft.rows[0].subject, "A personal hello");
  const original = await fetch(
    base + "/api/resume?id=" + resumePreview.resumeId,
  );
  assert.equal(original.status, 200);
  assert((await original.arrayBuffer()).byteLength > 0);
  assert.equal(original.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (await fetch(base + "/api/resume?id=" + crypto.randomUUID())).status,
    404,
  );
  const savedProjects = await api("/api/resume/projects", "POST", {
    useAI: false,
  });
  assert(savedProjects.projects.length > 0);
  assert.deepEqual(savedProjects.fields, {});
  assert.deepEqual(
    (await api("/api/workspace")).profile.projects,
    reloaded.profile.projects,
  );
  const editedProject = {
    ...reloaded.profile.projects[0],
    name: "Notes revised",
  };
  const projectSaved = await api("/api/workspace", "PATCH", {
    action: "project",
    project: editedProject,
    devfolio: "https://devfolio.co/@alex-builder",
  });
  assert.equal(projectSaved.profile.projects[0].name, "Notes revised");
  assert.equal(projectSaved.profile.name, reloaded.profile.name);
  assert.equal(projectSaved.profile.bio, reloaded.profile.bio);
  assert.equal(
    projectSaved.profile.devfolio,
    "https://devfolio.co/@alex-builder",
  );
  assert.deepEqual(projectSaved.jobs, reloaded.jobs);
  const sqlProject = await postgres.query(
    "select name from trail_projects where workspace_id = $1 and id = $2",
    [workspaceId, editedProject.id],
  );
  assert.equal(sqlProject.rows[0].name, "Notes revised");
  const addedProject = {
    ...editedProject,
    id: crypto.randomUUID(),
    name: "Second project",
  };
  assert.equal(
    (
      await api("/api/workspace", "PATCH", {
        action: "project",
        project: addedProject,
      })
    ).profile.projects.length,
    2,
  );
  const afterRemoval = await api("/api/workspace", "PATCH", {
    action: "delete-project",
    id: addedProject.id,
  });
  assert.deepEqual(afterRemoval.profile.projects, [editedProject]);
  assert.equal(
    afterRemoval.profile.devfolio,
    "https://devfolio.co/@alex-builder",
  );
  const bad = await fetch(base + "/api/workspace", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add-job",
      job: { ...job, url: "javascript:alert(1)" },
    }),
  });
  assert.equal(bad.status, 400);
  const blocked = await fetch(base + "/api/workspace", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      origin: "https://external.example",
    },
    body: JSON.stringify({ action: "clear-samples" }),
  });
  assert.equal(blocked.status, 400);
  const duplicate = await fetch(base + "/api/workspace", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add-job", job }),
  });
  assert.equal(duplicate.status, 400);
  for (const route of [
    "/",
    "/brand",
    "/about",
    "/privacy",
    "/dashboard",
    "/dashboard/discover",
    "/dashboard/applications",
    "/dashboard/outreach",
    "/dashboard/companies/turso",
    "/dashboard/contributions",
    "/dashboard/activity",
    "/dashboard/profile",
    "/dashboard/profile/projects/test-project",
    "/dashboard/profile/projects/new",
    "/dashboard/connections",
  ]) {
    assert.equal((await fetch(base + route)).status, 200);
  }
  const tuningEmpty = await api("/api/linkedin");
  assert.equal(tuningEmpty.sections.length, 0);
  const linkedInSection = {
    id: "qa-experience",
    label: "QA · Experience",
    kind: "experience",
    company: "QA Team",
    title: "Software Engineer",
    dates: "",
    currentText: "Built a TypeScript editor.",
    facts:
      "Built a TypeScript editor. Co-led the React frontend with one teammate. Integrated a public search API.",
  };
  await api("/api/linkedin", "PATCH", {
    action: "url",
    url: "https://www.linkedin.com/in/qa-builder",
  });
  const tuningSaved = await api("/api/linkedin", "PATCH", {
    action: "section",
    section: linkedInSection,
  });
  assert.equal(
    tuningSaved.sections[0].currentText,
    linkedInSection.currentText,
  );
  assert.equal(
    (await api("/api/linkedin")).sections[0].facts,
    linkedInSection.facts,
  );
  const staleSection = await fetch(base + "/api/linkedin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "section",
      section: linkedInSection,
      expectedVersion: 99,
    }),
  });
  assert.equal(staleSection.status, 400);
  assert.equal((await fetch(base + "/dashboard/linkedin")).status, 200);
  assert.equal(
    (await fetch(base + "/dashboard/linkedin/research")).status,
    200,
  );
  if (process.env.VERIFY_LINKEDIN === "1") {
    const reply = await api("/api/linkedin/chat", "POST", {
      sectionId: linkedInSection.id,
      message:
        "Rewrite this experience concisely. Preserve shared ownership and do not invent metrics. Use exactly the provided facts.",
    });
    const revision = reply.messages
      .filter((message) => message.role === "assistant")
      .at(-1)?.revisions[0];
    assert(revision, "A supported profile revision should be returned");
    assert.equal(revision.beforeText, linkedInSection.currentText);
    const published = await api("/api/linkedin", "PATCH", {
      action: "confirm-published",
      revisionId: revision.id,
      confirmed: true,
    });
    assert.equal(published.sections[0].currentText, revision.afterText);
    assert.equal(
      (await api("/api/linkedin")).sections[0].source,
      "user_confirmed",
    );
    const sqlSection = await postgres.query(
      "select current_text from trail_linkedin_sections where workspace_id = $1 and id = $2",
      [workspaceId, linkedInSection.id],
    );
    assert.equal(sqlSection.rows[0].current_text, revision.afterText);
    console.log(
      "Live LinkedIn chat → supported revision → confirmed current text → PostgreSQL reload passed.",
    );
  }
  if (process.env.VERIFY_COMPANIES === "1") {
    const finding = await api("/api/companies/discover", "POST", {
      query: "TypeScript, engineer",
    });
    assert(finding.companies.length > 0);
    assert(finding.sources.some((source) => source.checked > 0));
    const lead =
      finding.companies.find((company) => company.provider.startsWith("YC")) ||
      finding.companies[0];
    const saved = await api("/api/company", "POST", {
      url: lead.url,
      jobId: job.id,
    });
    const notebook = saved.workspace.companies.find(
      (company) => company.id === saved.companyId,
    );
    assert(notebook.notes.includes(`Research source: ${saved.source}`));
    assert(notebook.notes.includes("Checked:"));
    assert.equal(
      (await api("/api/workspace")).jobs.find((item) => item.id === job.id)
        .companyId,
      saved.companyId,
    );
    const repeated = await api("/api/company", "POST", { url: lead.url });
    assert.equal(repeated.companyId, saved.companyId);
    assert.equal((await api("/api/workspace")).companies.length, 1);
    assert.equal((await api("/api/workspace")).profile.name, "Trail QA");
    console.log(
      "Live company search → source hydration → database save → reload → duplicate prevention passed.",
    );
  }
  if (process.env.VERIFY_OPPORTUNITIES === "1") {
    const discovered = await api("/api/discover", "POST");
    assert.deepEqual(
      discovered.sources.map((source) => source.source),
      ["YC", "X", "LinkedIn"],
    );
    assert(discovered.sources.some((source) => source.status === "complete"));
    const reloaded = await api("/api/workspace");
    assert.deepEqual(
      [...reloaded.discovery.sources].sort((a, b) =>
        a.source.localeCompare(b.source),
      ),
      [...discovered.sources].sort((a, b) => a.source.localeCompare(b.source)),
    );
    assert.equal(reloaded.profile.name, "Trail QA");
    assert(
      reloaded.jobs.some(
        (item) => item.id === job.id && item.notes === job.notes,
      ),
    );
    const checkedJob =
      reloaded.jobs.find((item) => item.source === "YC") || reloaded.jobs[0];
    assert.equal(
      (
        await fetch(
          base + `/dashboard/companies/opportunities/${checkedJob.id}`,
        )
      ).status,
      200,
    );
    console.log(
      "Multi-source opportunity search → per-source statuses → SQL persistence → company page route passed.",
    );
    console.log(
      JSON.stringify(
        discovered.sources.map(
          ({ source, status, checked, matched, imported }) => ({
            source,
            status,
            checked,
            matched,
            imported,
          }),
        ),
      ),
    );
  }
  if (process.env.VERIFY_LIVE === "1") {
    const imported = await api("/api/project", "POST", {
      url: "https://github.com/unjs/unpdf",
    });
    assert.equal(imported.project.githubUrl, "https://github.com/unjs/unpdf");
    assert(imported.project.stack.includes("TypeScript"));
    const fixtureWorkspace = await api("/api/workspace", "PATCH", {
      action: "company",
      company: {
        id: "turso",
        name: "Turso",
        category: "Test fixture",
        description: "",
        website: "https://turso.tech",
        repo: "",
        color: "#eef1e9",
        initials: "T",
        notes: "",
        people: [],
      },
    });
    const fixtureId = fixtureWorkspace.companies.find(
      (c) => c.name === "Turso",
    ).id;
    const finding = await api("/api/companies/discover", "POST", {
      query: "TypeScript, Rust",
    });
    assert(finding.sources.some((source) => source.checked > 0));
    assert(
      finding.companies.every((company) => company.url.startsWith("https://")),
    );
    const x = await api("/api/company-research", "POST", {
      companyId: fixtureId,
      provider: "x-users",
      query: "Turso",
    });
    assert(x.results.some((r) => r.url === "https://x.com/tursodatabase"));
    const cachedSearch = await api("/api/company-research", "POST", {
      companyId: fixtureId,
      provider: "x-users",
      query: "Turso",
    });
    assert.equal(cachedSearch.cached, true);
    const discovered = await api("/api/discover", "POST");
    assert(discovered.checked > 0);
    assert(discovered.imported > 0);
    const again = await api("/api/discover", "POST");
    assert.equal(again.imported, 0);
    const git = await api("/api/github?username=octocat");
    assert(Array.isArray(git.repos));
    const company = await api("/api/company", "POST", {
      url: "https://www.ycombinator.com/companies/axle",
    });
    const notebook = company.workspace.companies.find(
      (c) => c.id === company.companyId,
    );
    assert(notebook.people.length > 0);
    assert(notebook.people.every((p) => p.evidence === company.source));
    const invalidSource = await fetch(base + "/api/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1:3000" }),
    });
    assert.equal(invalidSource.status, 400);
    const research = await api("/api/research?repo=tursodatabase%2Fturso");
    assert(research.rules.length > 0);
    assert(research.merged.every((p) => p.mergedAt));
    assert(research.issues.every((i) => i.tested === false));
    console.log(
      `Live sources: ${discovered.checked} YC listings; ${discovered.imported} imports; ${research.rules.length} policy files; ${research.merged.length} merged PRs; vouch detected: ${research.vouch}.`,
    );
  }
  console.log(
    "PASS: TXT/PDF/DOCX import previews, project attribution and persistence; profile → lead → application → follow-up → draft → edit → PostgreSQL persistence; individual project edits and deletion; duplicate and unsafe input rejection; 15 page routes.",
  );
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once("exit", resolve);
  });
  await socket.stop();
  await postgres.close();
}
