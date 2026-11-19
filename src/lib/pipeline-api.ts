// Server-side client for the Go pipeline service (services/pipeline).
// Enabled when PIPELINE_API_URL is set; otherwise the app keeps using Postgres.
import type { Draft, Job, Stage } from "./model";

export type GoJob = Job & { version: number; drafts: Draft[] };

export class PipelineApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function pipelineApiUrl() {
  return process.env.PIPELINE_API_URL?.replace(/\/$/, "") || "";
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const base = pipelineApiUrl();
  if (!base) throw new PipelineApiError("PIPELINE_API_URL is not set.", 503);
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new PipelineApiError(
      "The Go pipeline service is not reachable. Start it with: cd services/pipeline && go run ./cmd/pipeline-api",
      503,
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new PipelineApiError(
      body.error || `Pipeline service returned ${response.status}.`,
      response.status,
    );
  return body as T;
}

export const pipelineApi = {
  list: () => call<GoJob[]>("/jobs"),
  get: (id: string) => call<GoJob>(`/jobs/${encodeURIComponent(id)}`),
  create: (job: Job) =>
    call<GoJob>(`/jobs/${encodeURIComponent(job.id)}`, {
      method: "PUT",
      body: JSON.stringify(job),
    }),
  move: (
    id: string,
    change: {
      stage: Stage;
      channel?: string;
      followUp?: string;
      notes?: string;
      expectedVersion?: number;
    },
  ) =>
    call<GoJob>(`/jobs/${encodeURIComponent(id)}/stage`, {
      method: "PATCH",
      body: JSON.stringify(change),
    }),
  addDraft: (draft: Draft) =>
    call<Draft>(`/jobs/${encodeURIComponent(draft.jobId)}/drafts`, {
      method: "POST",
      body: JSON.stringify(draft),
    }),
  updateDraft: (
    jobId: string,
    draftId: string,
    subject: string,
    body: string,
  ) =>
    call<Draft>(
      `/jobs/${encodeURIComponent(jobId)}/drafts/${encodeURIComponent(draftId)}`,
      { method: "PATCH", body: JSON.stringify({ subject, body }) },
    ),
};

// The Go service only accepts the fields it models, so extra app-only fields
// (sample, logoSource) are dropped before sending.
export function toGoJob(job: Job): Job {
  return {
    id: job.id,
    company: job.company,
    companyId: job.companyId,
    companyWebsite: job.companyWebsite,
    logoUrl: job.logoUrl,
    role: job.role,
    source: job.source,
    url: job.url,
    description: job.description,
    location: job.location,
    tags: job.tags,
    stage: job.stage,
    channel: job.channel,
    appliedAt: job.appliedAt,
    followUp: job.followUp,
    notes: job.notes,
    health: job.health,
    addedAt: job.addedAt,
  };
}
