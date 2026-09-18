import { expect, test } from "bun:test";
import { checkOrigin, storageError } from "../src/lib/store";
test("cross-origin workspace mutations are rejected", () => {
  expect(() =>
    checkOrigin(
      new Request("http://127.0.0.1:3000/api/workspace", {
        headers: { origin: "https://external.example" },
      }),
    ),
  ).toThrow("Cross-origin");
  expect(() =>
    checkOrigin(
      new Request("http://127.0.0.1:3000/api/workspace", {
        headers: { origin: "http://127.0.0.1:3000" },
      }),
    ),
  ).not.toThrow();
});
test("browser-facing Host works when Next uses an internal localhost URL", () => {
  expect(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/resume", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  ).not.toThrow();
  expect(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/resume", {
        headers: {
          host: "127.0.0.1:3000",
          origin: "https://external.example",
          "x-forwarded-host": "external.example",
        },
      }),
    ),
  ).toThrow("Cross-origin");
});

test("database errors never expose bound personal data or connection details", () => {
  const failure = new Error("secret bound résumé text");
  failure.name = "DrizzleQueryError";
  expect(storageError(failure).message).not.toContain("secret");
  expect(
    storageError(new Error("Cross-origin changes are not allowed.")).message,
  ).toContain("Cross-origin");
});
