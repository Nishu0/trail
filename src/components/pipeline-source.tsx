"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useWorkspace, request } from "./workspace";
import type { Channel, Draft, Job, Stage, Workspace } from "@/lib/model";

type GoJob = Job & { version?: number };
type GoShape = { source: "go"; jobs: GoJob[]; drafts: Draft[] };
type Change = { stage: Stage; channel?: Channel; followUp?: string };

export type PipelineSource = {
  kind: "go" | "postgres" | "loading";
  error: string;
  jobs: GoJob[];
  drafts: Draft[];
  move: (job: GoJob, change: Change, note: string) => Promise<void>;
  saveDraft: (
    draft: Draft,
    subject: string,
    body: string,
    note?: string,
  ) => Promise<void>;
  writeDraft: (
    jobId: string,
    recipient?: { name: string; role: string },
  ) => Promise<void>;
  reload: () => void;
};

/**
 * Where the pipeline lives. When the server has PIPELINE_API_URL set, jobs,
 * stages and drafts come from the Go service (DynamoDB). Otherwise they come
 * from the Postgres workspace, exactly as before.
 */
export function usePipelineSource(): PipelineSource {
  const { data, run, mutate, replace, reload, setMessage } = useWorkspace();
  const [go, setGo] = useState<GoShape | null>(null);
  const [kind, setKind] = useState<PipelineSource["kind"]>("loading");
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    request<GoShape | { source: "postgres" }>("/api/pipeline", {
      signal: controller.signal,
    })
      .then((result) => {
        setError("");
        if (result.source === "go") {
          setGo(result);
          setKind("go");
        } else setKind("postgres");
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        // go is configured but down: show that, not stale postgres data.
        setKind("go");
        setGo({ source: "go", jobs: [], drafts: [] });
        setError((e as Error).message);
      });
    return () => controller.abort();
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  if (kind === "go")
    return {
      kind,
      error,
      jobs: go?.jobs ?? [],
      drafts: go?.drafts ?? [],
      reload: refetch,
      move: (job, change, note) =>
        run(async () => {
          setGo(
            await request<GoShape>("/api/pipeline", {
              method: "PATCH",
              body: JSON.stringify({
                action: "stage",
                id: job.id,
                ...change,
                expectedVersion: job.version,
              }),
            }),
          );
          setMessage(note);
        }),
      saveDraft: (draft, subject, body, note) =>
        run(async () => {
          setGo(
            await request<GoShape>("/api/pipeline", {
              method: "PATCH",
              body: JSON.stringify({
                action: "draft",
                jobId: draft.jobId,
                id: draft.id,
                subject,
                body,
              }),
            }),
          );
          if (note) setMessage(note);
        }),
      writeDraft: (jobId, recipient) =>
        run(async () => {
          await request("/api/draft", {
            method: "POST",
            body: JSON.stringify({ jobId, useAI: true, recipient }),
          });
          setGo(await request<GoShape>("/api/pipeline"));
          setMessage("Your email is ready for review.");
        }),
    };

  return {
    kind,
    error,
    jobs: (data?.jobs ?? []).filter((j) => !j.sample),
    drafts: data?.drafts ?? [],
    reload,
    move: (job, change, note) =>
      mutate({ action: "job", id: job.id, ...change }, note),
    saveDraft: (draft, subject, body, note) =>
      mutate(
        { action: "draft", id: draft.id, subject, body },
        note || "Saved.",
      ),
    writeDraft: (jobId, recipient) =>
      run(async () => {
        const result = await request<{ workspace: Workspace }>("/api/draft", {
          method: "POST",
          body: JSON.stringify({ jobId, useAI: true, recipient }),
        });
        replace(result.workspace);
        setMessage("Your email is ready for review.");
      }),
  };
}

const Context = createContext<PipelineSource | null>(null);
export const PipelineSourceProvider = Context.Provider;
export function useSource() {
  const source = useContext(Context);
  if (!source) throw new Error("Pipeline source is missing");
  return source;
}
