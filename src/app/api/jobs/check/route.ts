import {
  checkOrigin,
  getWorkspace,
  record,
  updateWorkspace,
} from "@/lib/store";
import { applyJobInspections, inspectWorkspaceJobs } from "@/lib/job-health";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json().catch(() => ({}));
    const before = await getWorkspace();
    const inspections = await inspectWorkspaceJobs(before, {
      force: body.force === true,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
    });
    let archived: string[] = [];
    const workspace = inspections.length
      ? await updateWorkspace((w) => {
          archived = applyJobInspections(w, inspections);
          if (archived.length)
            record(
              w,
              `Archived ${archived.length} unavailable job listing${archived.length === 1 ? "" : "s"} after checking the source`,
            );
        })
      : before;
    return Response.json(
      {
        workspace,
        checked: inspections.length,
        archived: archived.length,
        unavailable: inspections.filter(
          (i) => i.health.status === "unavailable",
        ).length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Job checks could not complete. Try again shortly." },
      { status: 502 },
    );
  }
}
