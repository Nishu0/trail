import { linkedinRepository } from "@/lib/linkedin-store";
import { storageError } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await (await linkedinRepository()).getResearch(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: storageError(error).message },
      { status: 503 },
    );
  }
}
