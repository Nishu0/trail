import { describe as suite, expect, test } from "bun:test";
import {
  describe,
  inTab,
  latestDraft,
  mailtoLink,
  suggestedRecipient,
} from "../src/lib/pipeline";
import type { Company, Draft, Job } from "../src/lib/model";

const job = (over: Partial<Job> = {}): Job => ({
  id: "j1",
  company: "Acme",
  role: "Backend Engineer",
  source: "YC",
  url: "",
  description: "",
  location: "Bengaluru",
  tags: [],
  stage: "Saved",
  notes: "",
  addedAt: "2026-11-01T00:00:00.000Z",
  ...over,
});
const draft = (over: Partial<Draft> = {}): Draft => ({
  id: "d1",
  jobId: "j1",
  subject: "s",
  body: "b",
  createdAt: "2026-11-02T00:00:00.000Z",
  mode: "ai",
  ...over,
});
const now = new Date("2026-11-20T06:30:00.000Z"); // 12:00 in India

suite("pipeline grouping", () => {
  test("a found company with a draft needs you", () => {
    expect(describe(job(), [draft()], now)).toMatchObject({
      group: "needs",
      next: "Ready to send",
    });
  });
  test("a found company without a draft is new", () => {
    expect(describe(job(), [], now).group).toBe("new");
  });
  test("contacted companies wait until the follow-up date", () => {
    const later = describe(
      job({ stage: "Applied", followUp: "2026-11-24" }),
      [],
      now,
    );
    expect(later).toMatchObject({ group: "waiting", next: "Follow up in 4d" });
    const due = describe(
      job({ stage: "Applied", followUp: "2026-11-20" }),
      [],
      now,
    );
    expect(due).toMatchObject({ group: "needs", next: "Follow up now" });
  });
  test("offers and archived roles are closed", () => {
    expect(describe(job({ stage: "Offer" }), [], now).group).toBe("closed");
    expect(describe(job({ stage: "Archived" }), [], now).group).toBe("closed");
  });
  test("tabs filter by stage", () => {
    const applied = job({ stage: "Interview" });
    expect(inTab(applied, "waiting", "contacted")).toBe(true);
    expect(inTab(applied, "waiting", "found")).toBe(false);
  });
});

test("latest draft wins", () => {
  const drafts = [
    draft(),
    draft({ id: "d2", createdAt: "2026-11-05T00:00:00.000Z" }),
  ];
  expect(latestDraft(drafts, "j1")?.id).toBe("d2");
});

test("founders are suggested before other people", () => {
  const company = {
    id: "c1",
    name: "Acme",
    people: [
      { name: "Riya", role: "Recruiter", linkedin: "", x: "", evidence: "" },
      {
        name: "Dev",
        role: "Co-founder & CEO",
        linkedin: "",
        x: "",
        evidence: "",
      },
    ],
  } as Company;
  expect(suggestedRecipient(job(), [company])?.name).toBe("Dev");
});

test("mailto keeps spaces and line breaks", () => {
  const link = mailtoLink("a@b.co", "hi there", "line one\nline two");
  expect(link).toBe(
    "mailto:a%40b.co?subject=hi%20there&body=line%20one%0Aline%20two",
  );
});
