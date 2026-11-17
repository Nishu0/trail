import { z } from "zod";
import { checkOrigin, getWorkspace } from "@/lib/store";
import { buildPrep } from "@/lib/interview-research";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = z
      .object({
        company: z.string().trim().min(2).max(120),
        role: z.string().trim().max(200).default(""),
        description: z.string().trim().max(20000).default(""),
        email: z.string().trim().max(12000).default(""),
        stage: z.enum(["intro", "tech", "hr"]).optional(),
      })
      .parse(await request.json());
    const workspace = await getWorkspace();
    return Response.json(
      await buildPrep(input, workspace.profile, request.signal),
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Add the company name to build a prep sheet."
            : (e as Error).message,
      },
      { status: 400 },
    );
  }
}
