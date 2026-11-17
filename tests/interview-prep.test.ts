import { expect, test } from "bun:test";
import { readInvite, STAGES } from "../src/lib/interview-prep";
import {
  assemblePrep,
  glassdoorSources,
  type PrepOutput,
} from "../src/lib/interview-research";
import {
  NEETCODE_150,
  PATTERNS,
  inferPatterns,
  problemUrl,
  recommendProblems,
} from "../src/lib/neetcode";

const invite = `Hi Sam,

Thank you for your interest in the Smart Contracts Developer (DAML/ Canton) role at Equilend. We'd like to invite you to a 15-minute recruiter interview via Microsoft Teams.

Please use the Calendly link below to book a time that suits you. You'll receive a calendar invite with joining details once scheduled.

Before we speak, review the job description on our careers page and find out more about us here.

Best,
Amit


Equilend`;

test("reads the stated facts from a recruiter invite", () => {
  const facts = readInvite(invite);
  expect(facts.company).toBe("Equilend");
  expect(facts.role).toBe("Smart Contracts Developer (DAML/ Canton)");
  expect(facts.stage).toBe("intro");
  expect(facts.minutes).toBe(15);
  expect(facts.platform).toBe("Microsoft Teams");
  expect(facts.interviewer).toBe("Amit");
  expect(facts.tasks).toHaveLength(3);
});

test("does not guess when the invite says nothing", () => {
  expect(readInvite("")).toEqual({
    company: "",
    role: "",
    stage: null,
    minutes: null,
    platform: "",
    interviewer: "",
    tasks: [],
  });
});

test("a technical word in the role title does not change the stage", () => {
  const facts = readInvite(
    "We'd like to invite you to an initial chat for the Technical Interview Coach role at Acme Labs. It will take 30 minutes on Zoom.",
  );
  expect(facts.role).toBe("Technical Interview Coach");
  expect(facts.company).toBe("Acme Labs");
  expect(facts.stage).toBe("intro");
  expect(
    readInvite("Your one hour live coding session on CoderPad is booked.")
      .stage,
  ).toBe("tech");
  expect(readInvite("This is the final round with our HR team.").stage).toBe(
    "hr",
  );
});

test("every stage playbook has five top questions", () => {
  expect(STAGES.map((stage) => stage.id)).toEqual(["intro", "tech", "hr"]);
  for (const stage of STAGES) {
    expect(stage.top).toHaveLength(5);
    expect(stage.general.length).toBeGreaterThanOrEqual(8);
    expect(stage.ask.length).toBeGreaterThanOrEqual(4);
  }
});

test("the NeetCode 150 is complete and links to neetcode.io", () => {
  expect(NEETCODE_150).toHaveLength(150);
  expect(new Set(NEETCODE_150.map((p) => p.slug)).size).toBe(150);
  expect(new Set(NEETCODE_150.map((p) => p.pattern))).toEqual(
    new Set(PATTERNS),
  );
  expect(
    problemUrl(NEETCODE_150.find((p) => p.name === "Contains Duplicate")!),
  ).toBe("https://neetcode.io/problems/duplicate-integer");
});

test("recommendations stay inside the chosen patterns, easiest first", () => {
  const picks = recommendProblems(["Binary Search", "Trees"], 6);
  expect(picks).toHaveLength(6);
  expect(
    picks.every((p) => ["Binary Search", "Trees"].includes(p.pattern)),
  ).toBe(true);
  expect(picks[0].name).toBe("Binary Search");
  expect(picks[0].difficulty).toBe("Easy");
  expect(recommendProblems([], 12)).toHaveLength(12);
  expect(inferPatterns("asked to write pseudocode for binary search")[0]).toBe(
    "Binary Search",
  );
});

test("keeps one Glassdoor interview page per review for the right employer", () => {
  const sources = glassdoorSources(
    [
      {
        title: "Equilend Interview",
        url: "https://www.glassdoor.com/Interview/Equilend-Interview-E259634-RVW97008653.htm",
        snippet: "Asked <strong>SQL joins</strong> &amp; Spring Boot.",
      },
      {
        title: "Equilend Interview",
        url: "https://www.glassdoor.co.in/Interview/Equilend-Interview-E259634-RVW97008653.htm",
        snippet: "Same review on another domain.",
      },
      {
        title: "Other Corp Interview Questions",
        url: "https://www.glassdoor.com/Interview/Other-Corp-Interview-Questions-E1.htm",
        snippet: "Unrelated.",
      },
      {
        title: "Equilend Reviews",
        url: "https://www.glassdoor.com/Reviews/Equilend-Reviews-E259634.htm",
        snippet: "Not an interview page.",
      },
      {
        title: "Equilend interview",
        url: "https://example.com/Interview/Equilend",
        snippet: "Not Glassdoor.",
      },
    ],
    "EquiLend",
  );
  expect(sources).toHaveLength(1);
  expect(sources[0].snippet).toBe("Asked SQL joins & Spring Boot.");
});

const input = {
  company: "Equilend",
  role: "Smart Contracts Developer",
  description: "",
  email: invite,
};
const source = {
  title: "Equilend Interview",
  url: "https://www.glassdoor.com/Interview/Equilend-Interview-E259634-RVW97008653.htm",
  snippet: "Asked to write pseudocode for binary search.",
};

test("without a model, the sheet falls back to the stage playbook", () => {
  const prep = assemblePrep(input, readInvite(invite), [source], null, "note");
  expect(prep.mode).toBe("starter");
  expect(prep.stage).toBe("intro");
  expect(prep.top).toHaveLength(5);
  expect(prep.reported).toBe("");
  expect(prep.patterns[0]).toBe("Binary Search");
  expect(prep.checklist[0]).toBe(
    "Book your slot with the scheduling link in the invite",
  );
  expect(prep.minutes).toBe(15);
});

test("a question is only marked as reported when it cites a found source", () => {
  const output: PrepOutput = {
    stage: "intro",
    brief: "A short recruiter call.",
    reported: "Candidates mention SQL and binary search.",
    topQuestions: [
      {
        question: "Why EquiLend?",
        why: "Interest check.",
        angle: "Be specific.",
        basis: "reported",
        sourceUrl: source.url,
      },
      {
        question: "Invented question?",
        why: "None.",
        angle: "None.",
        basis: "reported",
        sourceUrl: "https://www.glassdoor.com/Interview/made-up.htm",
      },
    ],
    generalQuestions: [],
    askThem: [],
    patterns: ["Trees"],
    topics: ["Daml templates", "daml templates"],
  };
  const prep = assemblePrep(input, readInvite(invite), [source], output, "");
  expect(prep.mode).toBe("ai");
  expect(prep.top).toHaveLength(5);
  expect(prep.top[0]).toMatchObject({
    basis: "reported",
    sourceUrl: source.url,
  });
  expect(prep.top[1].basis).toBe("role");
  expect(prep.top[1].sourceUrl).toBeUndefined();
  expect(prep.patterns).toEqual(["Trees"]);
  expect(prep.topics).toEqual(["Daml templates"]);
  expect(prep.general.length).toBeGreaterThanOrEqual(8);
});
