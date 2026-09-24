import {
  checkOrigin,
  getWorkspace,
  record,
  updateWorkspace,
} from "@/lib/store";
import { applyDiscovery } from "@/lib/job-discovery";
import { findOpportunities } from "@/lib/job-finder";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { profile, employerExclusions } = await getWorkspace();
    const result = await findOpportunities(profile, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
      excludedEmployers: employerExclusions,
    });
    const workspace = await updateWorkspace((w) => {
      applyDiscovery(w, result);
      record(
        w,
        result.sources
          .map(
            (source) =>
              `${source.source}: ${source.status === "complete" ? `${source.checked} checked, ${source.imported} saved` : source.status.replace("_", " ")}`,
          )
          .join(" · "),
      );
    });
    return Response.json(
      {
        workspace,
        sources: result.sources,
        checked: result.sources.reduce(
          (sum, source) => sum + source.checked,
          0,
        ),
        matched: result.sources.reduce(
          (sum, source) => sum + source.matched,
          0,
        ),
        imported: result.sources.reduce(
          (sum, source) => sum + source.imported,
          0,
        ),
        note: "Searched YC, live X posts, and publicly indexed LinkedIn job pages. Source availability and results are reported separately.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
