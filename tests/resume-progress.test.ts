import { expect, test } from "bun:test";
import {
  readResumeResponse,
  type ResumeStage,
} from "../src/lib/resume-progress";

function streamed(text: string) {
  const bytes = new TextEncoder().encode(text);
  // One byte at a time catches split JSON lines and split Unicode characters.
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson" } },
  );
}

test("résumé stream reads split events and preserves Unicode in the completed result", async () => {
  const result = {
    fields: { name: "José Builder" },
    text: "Résumé",
    filename: "résumé.txt",
    warnings: [],
    mode: "Local extraction",
    projectLinks: [],
    projects: [],
  };
  const stages: ResumeStage[] = [];
  const response = streamed(
    [
      JSON.stringify({ type: "progress", stage: "reading" }),
      JSON.stringify({ type: "progress", stage: "matching" }),
      JSON.stringify({ type: "complete", result }),
    ].join("\n"),
  );
  expect(
    await readResumeResponse(response, (stage) => stages.push(stage)),
  ).toEqual(result);
  expect(stages).toEqual(["reading", "matching"]);
});

test("provider failures and interrupted streams cannot appear as successful imports", async () => {
  await expect(
    readResumeResponse(
      streamed('{"type":"error","error":"Claude is unavailable"}\n'),
      () => {},
    ),
  ).rejects.toThrow("Claude is unavailable");
  await expect(
    readResumeResponse(
      streamed('{"type":"progress","stage":"matching"}\n'),
      () => {},
    ),
  ).rejects.toThrow("Processing was interrupted");
});

test("preflight JSON errors remain readable by the streaming client", async () => {
  await expect(
    readResumeResponse(
      Response.json({ error: "Choose a résumé up to 5 MB." }, { status: 400 }),
      () => {},
    ),
  ).rejects.toThrow("Choose a résumé up to 5 MB.");
});
