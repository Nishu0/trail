import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { getDatabase, closeDatabase } from "../src/db/client";
import {
  createWorkspaceRepository,
  DEFAULT_WORKSPACE_ID,
} from "../src/db/workspace-repository";
import { profileSchema, jobSchema, companySchema } from "../src/lib/validation";
import { z } from "zod";
import type { Workspace } from "../src/lib/model";
config({ path: ".env.local", quiet: true });
const schema = z.object({
  version: z.literal(1),
  profile: profileSchema,
  jobs: z.array(
    jobSchema.extend({
      id: z.string(),
      stage: z.enum(["Saved", "Applied", "Interview", "Offer", "Archived"]),
      channel: z.enum(["Email", "X", "Job form"]).optional(),
      appliedAt: z.iso.datetime().optional(),
      followUp: z.string().optional(),
      sample: z.boolean().optional(),
      addedAt: z.iso.datetime(),
    }),
  ),
  companies: z.array(companySchema.extend({ id: z.string() })),
  drafts: z.array(
    z.object({
      id: z.string(),
      jobId: z.string(),
      subject: z.string(),
      body: z.string(),
      createdAt: z.iso.datetime(),
      mode: z.enum(["starter", "ai"]),
    }),
  ),
  activity: z.array(
    z.object({ id: z.string(), text: z.string(), at: z.iso.datetime() }),
  ),
  lastDiscovery: z.iso.datetime().optional(),
});
try {
  const legacy = schema.parse(
    JSON.parse(
      await readFile(process.argv[2] || ".data/workspace.json", "utf8"),
    ),
  ) as Workspace;
  const repo = createWorkspaceRepository(
    getDatabase(),
    process.env.TRAIL_WORKSPACE_ID || DEFAULT_WORKSPACE_ID,
  );
  const { imported, workspace } = await repo.importLegacy(legacy);
  console.log(
    JSON.stringify({
      imported,
      profileSaved: !!workspace.profile.name,
      resumeSaved: !!workspace.profile.resume,
      projects: workspace.profile.projects.length,
      jobs: workspace.jobs.length,
      companies: workspace.companies.length,
      drafts: workspace.drafts.length,
      activities: workspace.activity.length,
    }),
  );
  console.log(
    "The original JSON file is preserved as a migration backup; the application no longer uses it.",
  );
} catch {
  console.error(
    "Legacy import stopped. Check the connection, migrations and input data. Existing database data and the local backup are preserved.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
