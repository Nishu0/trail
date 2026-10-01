import { getDatabase } from "../db/client";
import { DEFAULT_WORKSPACE_ID } from "../db/workspace-repository";
import { createLinkedInRepository } from "../db/linkedin-repository";
import { getWorkspace } from "./store";
export async function linkedinRepository() {
  await getWorkspace();
  const id = process.env.TRAIL_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
  return createLinkedInRepository(getDatabase(), id);
}
