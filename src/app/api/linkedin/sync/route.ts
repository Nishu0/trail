import { checkOrigin, storageError } from "@/lib/store";
import { linkedinRepository } from "@/lib/linkedin-store";
import { refreshPublicProfile } from "@/lib/linkedin-tuning";
export async function GET() {
  try {
    return Response.json(
      await (await linkedinRepository()).getLatestSnapshot(),
    );
  } catch (error) {
    return Response.json(
      { error: storageError(error).message },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const repo = await linkedinRepository();
    const state = await repo.getState();
    if (!state.profileUrl)
      throw new Error("Save your LinkedIn profile link first.");
    let result;
    try {
      result = await refreshPublicProfile(state.profileUrl, {
        signal: request.signal,
      });
    } catch {
      result = {
        status: "unavailable",
        text: "",
        note: "Public refresh could not complete. Your current sections are unchanged; paste their latest text from LinkedIn.",
      };
    }
    await repo.saveSync(
      state.profileUrl,
      result.status,
      result.text,
      result.note,
    );
    return Response.json({
      state: await repo.getState(),
      snapshot: await repo.getLatestSnapshot(),
    });
  } catch (error) {
    return Response.json(
      { error: storageError(error).message },
      { status: 400 },
    );
  }
}
