import type { ResumeImport } from "./resume";

export type ResumeStage = "reading" | "matching" | "projects" | "preparing";
export type ResumeEvent =
  | { type: "progress"; stage: ResumeStage }
  | { type: "complete"; result: ResumeImport }
  | { type: "error"; error: string };

// A streamed event can be split across network chunks, including UTF-8 characters.
export async function readResumeResponse(
  response: Response,
  onProgress: (stage: ResumeStage) => void,
): Promise<ResumeImport> {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/x-ndjson")
  ) {
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not read the résumé.");
    return data;
  }
  if (!response.body)
    throw new Error("The résumé response was empty. Please try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ResumeImport | undefined;
  function consume(line: string) {
    if (!line.trim()) return;
    const event: ResumeEvent = JSON.parse(line);
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "complete") result = event.result;
    if (event.type === "progress") onProgress(event.stage);
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(consume);
      if (done) break;
    }
    consume(buffer);
    if (!result)
      throw new Error(
        "Processing was interrupted. Please try reading your résumé again.",
      );
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
