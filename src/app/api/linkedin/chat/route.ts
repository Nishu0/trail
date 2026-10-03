import { z } from "zod";
import { checkOrigin, storageError } from "@/lib/store";
import { linkedinRepository } from "@/lib/linkedin-store";
import { tuneLinkedIn } from "@/lib/linkedin-tuning";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { message, sectionId } = z
      .object({
        message: z.string().trim().min(1).max(12000),
        sectionId: z.string().min(1).max(100),
      })
      .parse(await request.json());
    const repo = await linkedinRepository();
    const state = await repo.getState();
    if (!state.sections.some((s) => s.id === sectionId))
      throw new Error("Choose a saved profile section first.");
    const { run } = await repo.getResearch();
    await repo.addMessage("user", message, sectionId);
    const result = await tuneLinkedIn(
      state,
      message,
      sectionId,
      run?.insights || [],
      { signal: request.signal },
    );
    await repo.addAssistant(result.reply, result.revisions, sectionId);
    return Response.json(await repo.getState());
  } catch (error) {
    return Response.json(
      { error: storageError(error).message },
      { status: 502 },
    );
  }
}
