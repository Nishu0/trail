import { describe, expect, test } from "bun:test";
import {
  dueJobs,
  emptyProfile,
  fit,
  initialWorkspace,
  starterDraft,
} from "../src/lib/model";
import { jobSchema, mutationSchema } from "../src/lib/validation";
import { testJob as realJob } from "./fixtures/workspace";
describe("evidence and follow-ups", () => {
  test("missing skills never produce an invented fit score", () => {
    expect(fit(realJob, emptyProfile)).toEqual({ score: null, reasons: [] });
  });
  test("fit exposes exactly the matching evidence", () => {
    expect(
      fit(realJob, { ...emptyProfile, skills: "TypeScript, Rust" }),
    ).toEqual({ score: 50, reasons: ["typescript"] });
  });
  test("follow-ups become due on the scheduled local date and ignore samples and closed stages", () => {
    const jobs = [
      { ...realJob, stage: "Applied", followUp: "2026-10-09" },
      { ...realJob, id: "tomorrow", stage: "Applied", followUp: "2026-10-10" },
      {
        ...realJob,
        id: "sample",
        sample: true,
        stage: "Applied",
        followUp: "2026-10-08",
      },
      { ...realJob, id: "offer", stage: "Offer", followUp: "2026-10-08" },
    ];
    expect(
      dueJobs(jobs, new Date("2026-10-09T00:00:00+05:30")).map((j) => j.id),
    ).toEqual(["real-1"]);
  });
  test("starter drafts use supplied evidence and leave missing details visible", () => {
    const profile = {
      ...emptyProfile,
      name: "Alex",
      bio: "I build tools in TypeScript.",
      projects: [
        {
          id: "1",
          name: "Atlas",
          description: "A local-first notes app.",
          url: "https://example.com/atlas",
          platform: "GitHub",
          stack: "TypeScript",
        },
      ],
    };
    const draft = starterDraft(realJob, profile);
    expect(draft.body).toContain("Atlas");
    expect(draft.body).toContain("https://example.com/atlas");
    expect(draft.body).toContain("[Add a specific detail");
    expect(draft.body).not.toContain("years of experience");
  });
});
describe("input validation", () => {
  test("script URLs cannot be persisted as source links", () => {
    expect(
      jobSchema.safeParse({ ...realJob, url: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
  test("application stages are constrained", () => {
    expect(
      mutationSchema.safeParse({
        action: "job",
        id: "1",
        stage: "Sent automatically",
      }).success,
    ).toBe(false);
  });
  test("follow-up dates require an ISO calendar date", () => {
    expect(
      mutationSchema.safeParse({
        action: "snooze",
        id: "1",
        followUp: "next week",
      }).success,
    ).toBe(false);
  });
});
