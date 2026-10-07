import { config } from "dotenv";
import { closeDatabase } from "../src/db/client";
import { getWorkspace, updateWorkspace, record } from "../src/lib/store";
import {
  applyJobInspections,
  inspectWorkspaceJobs,
} from "../src/lib/job-health";
config({ path: ".env.local", quiet: true });
try {
  const before = await getWorkspace();
  const inspections = await inspectWorkspaceJobs(before, {
    force: process.argv.includes("--force"),
    signal: AbortSignal.timeout(55000),
  });
  let archived: string[] = [];
  if (inspections.length)
    await updateWorkspace((w) => {
      archived = applyJobInspections(w, inspections);
      if (archived.length)
        record(
          w,
          `Archived ${archived.length} closed or removed job listings after checking their sources`,
        );
    });
  console.log(
    JSON.stringify({
      checked: inspections.length,
      archived: archived.map((id) => {
        const j = before.jobs.find((j) => j.id === id)!;
        return {
          company: j.company,
          role: j.role,
          reason: inspections.find((i) => i.id === id)?.health.reason,
        };
      }),
      unavailable: inspections.filter((i) => i.health.status === "unavailable")
        .length,
      logos: inspections.filter((i) => i.logoUrl).length,
    }),
  );
} catch {
  console.error(
    "Job check failed. Verify database connectivity; no credentials or profile details are printed.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
