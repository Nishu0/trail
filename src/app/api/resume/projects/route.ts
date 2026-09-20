import { checkOrigin, getWorkspace } from "@/lib/store";
import { resumeText } from "@/lib/resume";
import { getResumeFile } from "@/lib/store";
import { extractResumeDetails } from "@/lib/resume-details";
import type { ResumeEvent } from "@/lib/resume-progress";
import { boundedBytes } from "@/lib/import-utils";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { useAI } = z
      .object({ useAI: z.boolean().default(!!process.env.ANTHROPIC_API_KEY) })
      .parse(
        request.body
          ? JSON.parse(
              new TextDecoder().decode(await boundedBytes(request.body, 4096)),
            )
          : {},
      );
    const { profile } = await getWorkspace();
    if (!profile.resume?.text)
      return Response.json(
        { error: "Upload and save a résumé first." },
        { status: 400 },
      );
    const resume = profile.resume;
    async function processResume(
      send: (event: ResumeEvent) => void,
      signal: AbortSignal,
    ) {
      send({ type: "progress", stage: "reading" });
      const original =
        resume.id && resume.fileStored ? await getResumeFile(resume.id) : null;
      const text = original?.content
        ? await resumeText(Buffer.from(original.content), original.filename)
        : resume.text;
      const details = await extractResumeDetails(text, {
        useAI,
        apiKey: process.env.ANTHROPIC_API_KEY,
        signal,
        identity: { name: profile.name, github: profile.github },
        onProgress: (stage) => send({ type: "progress", stage }),
      });
      return {
        ...details,
        fields:
          !profile.devfolio && details.fields.devfolio
            ? { devfolio: details.fields.devfolio }
            : {},
        resumeId: resume.id,
        filename: resume.name,
        text,
      };
    }
    if (!request.headers.get("accept")?.includes("application/x-ndjson"))
      return Response.json(
        await processResume(
          () => {},
          AbortSignal.any([request.signal, AbortSignal.timeout(90000)]),
        ),
      );
    const encoder = new TextEncoder();
    const abort = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: ResumeEvent) => {
          if (!cancelled)
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };
        try {
          const result = await processResume(
            send,
            AbortSignal.any([
              request.signal,
              abort.signal,
              AbortSignal.timeout(90000),
            ]),
          );
          send({ type: "complete", result });
        } catch (e) {
          send({ type: "error", error: (e as Error).message });
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() {
        cancelled = true;
        abort.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
