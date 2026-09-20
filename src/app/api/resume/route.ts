import { checkOrigin, saveResumeImport, getResumeFile } from "@/lib/store";
import { boundedBytes } from "@/lib/import-utils";
import { resumeText } from "@/lib/resume";
import { extractResumeDetails } from "@/lib/resume-details";
import type { ResumeEvent, ResumeStage } from "@/lib/resume-progress";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const bytes = await boundedBytes(request.body, 5 * 1024 * 1024 + 65536);
    const form = await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
      throw new Error("Choose a résumé up to 5 MB.");
    const resumeFile = file;
    const useAI = form.has("useAI")
      ? form.get("useAI") === "true"
      : !!process.env.ANTHROPIC_API_KEY;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (useAI && !apiKey)
      return Response.json(
        {
          error:
            "Claude autofill needs ANTHROPIC_API_KEY in .env.local. Turn it off to use local extraction.",
        },
        { status: 503 },
      );
    async function processResume(
      onProgress: (stage: ResumeStage) => void,
      signal: AbortSignal,
    ) {
      onProgress("reading");
      const text = (
        await resumeText(
          Buffer.from(await resumeFile.arrayBuffer()),
          resumeFile.name,
        )
      ).trim();
      if (text.length < 30)
        throw new Error(
          "No readable text found. For a scanned PDF, export a text-based PDF or upload DOCX / TXT.",
        );
      if (text.length > 60000)
        throw new Error(
          "This résumé contains too much text. Upload a shorter version.",
        );
      const details = await extractResumeDetails(text, {
        useAI,
        apiKey,
        signal,
        onProgress,
      });
      const resumeId = await saveResumeImport({
        filename: resumeFile.name.slice(0, 250),
        content: Buffer.from(await resumeFile.arrayBuffer()),
        contentType:
          resumeFile.type ||
          (resumeFile.name.endsWith(".pdf")
            ? "application/pdf"
            : resumeFile.name.endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/plain"),
        text,
        fields: details.fields,
        model: details.mode,
      });
      return {
        resumeId,
        ...details,
        text,
        filename: resumeFile.name.slice(0, 250),
      };
    }
    // Keep JSON available for existing clients; the upload UI requests live stages.
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
        function send(event: ResumeEvent) {
          if (!cancelled)
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
        try {
          const result = await processResume(
            (stage) => send({ type: "progress", stage }),
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

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    return Response.json({ error: "Résumé not found." }, { status: 404 });
  try {
    const file = await getResumeFile(id);
    if (!file?.content)
      return Response.json(
        {
          error:
            "Original file is unavailable for this import. Upload your résumé again to retain the original.",
        },
        { status: 404 },
      );
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Unable to read the résumé from the database." },
      { status: 503 },
    );
  }
}
