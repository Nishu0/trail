import { expect, test } from "bun:test";
import { extractResumeWithClaude, RESUME_MODEL } from "../src/lib/resume-ai";
test("résumé autofill calls Haiku 5.5 directly and validates structured profile fields", async () => {
  let requestBody: Record<string, any> = {};
  const facts = {
    name: "Alex Builder",
    headline: "Product engineer",
    bio: "I built developer tools.",
    skills: "TypeScript, React",
    location: "",
    projects: [
      {
        name: "Notes",
        description: "A local notes app.",
        stack: "TypeScript",
        links: ["https://github.com/alex/notes"],
      },
    ],
  };
  const mockFetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect(new Headers(init?.headers).get("x-api-key")).toBe("test-only-key");
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: RESUME_MODEL,
      content: [{ type: "text", text: JSON.stringify(facts) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 40 },
    });
  }) as typeof fetch;
  const extracted = await extractResumeWithClaude(
    "Alex Builder\nProduct engineer\nI built developer tools in TypeScript and React.",
    { apiKey: "test-only-key", fetch: mockFetch },
  );
  expect(extracted).toEqual(facts);
  expect(requestBody.model).toBe("claude-haiku-5-5");
  expect(requestBody.output_config.format.type).toBe("json_schema");
  expect(requestBody.output_config.effort).toBe("low");
  expect(requestBody).not.toHaveProperty("temperature");
  expect(requestBody).not.toHaveProperty("top_p");
  expect(requestBody).not.toHaveProperty("top_k");
});
