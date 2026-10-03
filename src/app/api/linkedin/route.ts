import { z } from "zod";
import { checkOrigin, storageError } from "@/lib/store";
import { linkedinRepository } from "@/lib/linkedin-store";
import { sectionInput } from "@/lib/linkedin-types";
import { linkedinProfileUrl } from "@/lib/linkedin-tuning";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await (await linkedinRepository()).getState(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const cause = (
      error as {
        cause?: { code?: string; table?: string; constraint?: string };
      }
    )?.cause;
    console.error(
      JSON.stringify({
        event: "linkedin_storage_read_failed",
        code: cause?.code,
        table: cause?.table,
        constraint: cause?.constraint,
      }),
    );
    return Response.json(
      { error: storageError(error).message },
      { status: 503 },
    );
  }
}
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("url"), url: z.string().max(1000) }),
  z.object({
    action: z.literal("section"),
    section: sectionInput,
    expectedVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("confirm-published"),
    revisionId: z.uuid(),
    confirmed: z.literal(true),
  }),
]);
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const data = mutation.parse(await request.json());
    const repo = await linkedinRepository();
    if (data.action === "url") await repo.saveUrl(linkedinProfileUrl(data.url));
    if (data.action === "section")
      await repo.saveSection(data.section, data.expectedVersion);
    if (data.action === "confirm-published")
      await repo.confirmRevision(data.revisionId);
    return Response.json(await repo.getState());
  } catch (error) {
    return Response.json(
      { error: storageError(error).message },
      { status: 400 },
    );
  }
}
