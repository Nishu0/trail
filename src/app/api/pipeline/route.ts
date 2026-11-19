import { z } from "zod";
import { checkOrigin, getWorkspace } from "@/lib/store";
import {
  pipelineApi,
  pipelineApiUrl,
  PipelineApiError,
  toGoJob,
  type GoJob,
} from "@/lib/pipeline-api";

export const dynamic = "force-dynamic";

// Jobs are still discovered and saved through Postgres. Any saved job the Go
// service has not seen yet is copied over, so the pipeline never misses one.
async function listWithBackfill() {
  const [goJobs, workspace] = await Promise.all([
    pipelineApi.list(),
    getWorkspace(),
  ]);
  const known = new Set(goJobs.map((j) => j.id));
  const missing = workspace.jobs.filter((j) => !j.sample && !known.has(j.id));
  for (const job of missing) {
    try {
      goJobs.push(await pipelineApi.create(toGoJob(job)));
    } catch (e) {
      if (!(e instanceof PipelineApiError && e.status === 409)) throw e;
    }
  }
  return goJobs;
}

function shape(jobs: GoJob[]) {
  return {
    source: "go" as const,
    jobs: jobs.map(({ drafts, ...job }) => job),
    drafts: jobs.flatMap((j) => j.drafts),
  };
}

function failure(e: unknown) {
  const status = e instanceof PipelineApiError ? e.status : 400;
  return Response.json(
    { error: e instanceof Error ? e.message : "Pipeline request failed." },
    { status },
  );
}

export async function GET() {
  if (!pipelineApiUrl()) return Response.json({ source: "postgres" });
  try {
    return Response.json(shape(await listWithBackfill()));
  } catch (e) {
    return failure(e);
  }
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const change = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("stage"),
    id: z.string().min(1),
    stage: z.enum(["Saved", "Applied", "Interview", "Offer", "Archived"]),
    channel: z.enum(["Email", "X", "Job form"]).optional(),
    followUp: z.union([date, z.literal("")]).optional(),
    expectedVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("draft"),
    jobId: z.string().min(1),
    id: z.string().min(1),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(20000),
  }),
]);

export async function PATCH(request: Request) {
  if (!pipelineApiUrl())
    return Response.json(
      { error: "The Go pipeline service is not enabled." },
      { status: 404 },
    );
  try {
    checkOrigin(request);
    const input = change.parse(await request.json());
    if (input.action === "stage") {
      await pipelineApi.move(input.id, {
        stage: input.stage,
        channel: input.channel,
        followUp: input.followUp,
        expectedVersion: input.expectedVersion,
      });
    } else {
      await pipelineApi.updateDraft(
        input.jobId,
        input.id,
        input.subject,
        input.body,
      );
    }
    return Response.json(shape(await pipelineApi.list()));
  } catch (e) {
    return failure(e);
  }
}
