import { getDatabase } from "../db/client";
import {
  createWorkspaceRepository,
  DEFAULT_WORKSPACE_ID,
} from "../db/workspace-repository";
import type { Workspace } from "./model";
function repository() {
  const id = process.env.TRAIL_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error("TRAIL_WORKSPACE_ID must be a UUID.");
  return createWorkspaceRepository(getDatabase(), id);
}
// Never expose SQL queries, bound résumé text, or connection details in API errors.
export function storageError(error: unknown) {
  if (
    error instanceof Error &&
    (error.name === "DrizzleQueryError" || "code" in error || "cause" in error)
  )
    return new Error(
      "Database request failed. Check the Neon connection and run bun run db:migrate.",
    );
  return error instanceof Error ? error : new Error("Database request failed.");
}
export async function getWorkspace() {
  try {
    return await repository().getWorkspace();
  } catch (e) {
    throw storageError(e);
  }
}
export async function updateWorkspace(change: (workspace: Workspace) => void) {
  try {
    return await repository().updateWorkspace(change);
  } catch (e) {
    throw storageError(e);
  }
}
export async function saveResumeImport(
  input: Parameters<
    ReturnType<typeof createWorkspaceRepository>["saveResume"]
  >[0],
) {
  try {
    return await repository().saveResume(input);
  } catch (e) {
    throw storageError(e);
  }
}
export function record(workspace: Workspace, text: string) {
  workspace.activity.unshift({
    id: crypto.randomUUID(),
    text,
    at: new Date().toISOString(),
  });
  workspace.activity = workspace.activity.slice(0, 60);
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next's internal URL can use localhost while the browser uses 127.0.0.1.
  // Host is the browser-facing authority; do not trust forwarded-host headers.
  const host = request.headers.get("host");
  const browserOrigin = host ? `${url.protocol}//${host}` : url.origin;
  if (origin && origin !== browserOrigin)
    throw new Error("Cross-origin changes are not allowed.");
}

export async function getResumeFile(id: string) {
  try {
    return await repository().getResumeFile(id);
  } catch (e) {
    throw storageError(e);
  }
}
