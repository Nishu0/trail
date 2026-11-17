import type { Pattern } from "./neetcode";
export type StageId = "intro" | "tech" | "hr";
export type QuestionBasis = "reported" | "role" | "stage";
export type TopQuestion = {
  question: string;
  why: string;
  angle: string;
  basis: QuestionBasis;
  sourceUrl?: string;
};
export type GeneralQuestion = { question: string; category: string };
export type Playbook = {
  top: TopQuestion[];
  general: GeneralQuestion[];
  ask: string[];
  checklist: string[];
};
export type StageGuide = Playbook & {
  id: StageId;
  step: string;
  label: string;
  title: string;
  line: string;
  length: string;
  who: string;
  checks: string[];
  brief: string;
};
export type PrepSource = { title: string; url: string; snippet: string };
export type Invite = {
  company: string;
  role: string;
  stage: StageId | null;
  minutes: number | null;
  platform: string;
  interviewer: string;
  tasks: string[];
};
export type PersonalPrep = Playbook & {
  id: string;
  createdAt: string;
  company: string;
  role: string;
  stage: StageId;
  minutes: number | null;
  platform: string;
  interviewer: string;
  brief: string;
  reported: string;
  sources: PrepSource[];
  patterns: Pattern[];
  topics: string[];
  mode: "ai" | "starter";
  note: string;
};

export const STAGES: StageGuide[] = [
  {
    id: "intro",
    step: "01",
    label: "Intro call",
    title: "The recruiter screen",
    line: "A short conversation to confirm you, the role and the logistics line up.",
    length: "15–30 min",
    who: "Recruiter",
    checks: [
      "You understand the role",
      "A clear, short story",
      "Real interest in the company",
      "Pay, location and timing fit",
    ],
    brief:
      "The recruiter is usually not an engineer. They are checking fit, level, compensation and logistics, then deciding whether to put you in front of the team. Short, specific answers win. Leave time for your own questions, and end by confirming the next step.",
    top: [
      {
        question: "Tell me about yourself.",
        why: "It opens almost every screen, and sets the tone for the rest of the call.",
        angle:
          "Sixty to ninety seconds: where you are now, one or two things you built that match this role, and why this role is next.",
        basis: "stage",
      },
      {
        question: "Why this role, and why this company?",
        why: "Recruiters filter out people who apply everywhere without reading.",
        angle:
          "Name one thing about the product or the team’s work, then connect it to something you have actually done.",
        basis: "stage",
      },
      {
        question: "What do you know about what we do?",
        why: "A quick check that you read the job description and the About page.",
        angle:
          "Two sentences in your own words: who the customers are, and what problem the product solves for them.",
        basis: "stage",
      },
      {
        question: "Walk me through your most relevant experience.",
        why: "They need one concrete example to pass along to the hiring manager.",
        angle:
          "Pick one project. Say the problem, what you built, the stack, and the result. Keep it under two minutes.",
        basis: "stage",
      },
      {
        question: "What are your salary expectations?",
        why: "Compensation alignment is one of the main reasons this call exists.",
        angle:
          "Research a range first. Ask for the band if you can; if you give a number, give a range you would accept.",
        basis: "stage",
      },
    ],
    general: [
      { category: "Your story", question: "Why are you looking right now?" },
      {
        category: "Your story",
        question: "What are you looking for in your next role?",
      },
      {
        category: "Your story",
        question: "Which part of your recent work are you proudest of?",
      },
      {
        category: "Role fit",
        question: "Which parts of the job description match you best?",
      },
      {
        category: "Role fit",
        question: "Is there anything in the description you have not done yet?",
      },
      {
        category: "Role fit",
        question: "How many years have you worked with the main stack?",
      },
      {
        category: "Logistics",
        question: "When could you start? Do you have a notice period?",
      },
      {
        category: "Logistics",
        question:
          "Where are you based, and are you open to hybrid or relocation?",
      },
      {
        category: "Logistics",
        question: "Do you need visa sponsorship or a work permit?",
      },
      {
        category: "Logistics",
        question: "Are you interviewing anywhere else?",
      },
    ],
    ask: [
      "What does the rest of the interview process look like, and how long does it take?",
      "What will the technical round focus on?",
      "Who would I work with, and who does the role report to?",
      "What would a strong first three months look like?",
      "Is there a salary band for this role?",
    ],
    checklist: [
      "Read the job description twice and mark three matches",
      "Read the company’s About page and one recent announcement",
      "Say your 60-second introduction out loud once",
      "Decide your salary range and earliest start date",
      "Test the meeting link, microphone and camera",
      "Write down three questions to ask",
    ],
  },
  {
    id: "tech",
    step: "02",
    label: "Tech call",
    title: "The technical round",
    line: "Problem solving out loud, plus a close look at something you built.",
    length: "45–60 min",
    who: "Engineers",
    checks: [
      "How you reason out loud",
      "Working, readable code",
      "Trade-offs and complexity",
      "Depth in your own projects",
    ],
    brief:
      "Engineers on the team watch how you think, not only whether you finish. Restate the problem, ask what is unclear, talk through a simple approach before the fast one, then test your code with a small example. Expect questions that go deep into a project on your résumé.",
    top: [
      {
        question: "Walk me through a project you built, end to end.",
        why: "It shows what you really did, and how well you understand your own decisions.",
        angle:
          "Problem, your part, the design, one hard decision, and what you would change. Be ready to go two levels deeper.",
        basis: "stage",
      },
      {
        question: "Solve this problem while thinking out loud.",
        why: "The core of most technical rounds: a data-structures problem in 30–45 minutes.",
        angle:
          "Clarify inputs and edge cases, state a brute-force idea, improve it, then code. Say the time and space cost.",
        basis: "stage",
      },
      {
        question: "What is the time and space complexity? Can it be better?",
        why: "Interviewers want to see that you can measure and improve your own solution.",
        angle:
          "Answer in Big-O, name the bottleneck, and offer one trade-off even if you keep the current solution.",
        basis: "stage",
      },
      {
        question: "Tell me about a hard bug and how you tracked it down.",
        why: "Debugging method is a strong signal of real experience.",
        angle:
          "Symptom, how you narrowed it down, the root cause, the fix, and what you changed so it does not return.",
        basis: "stage",
      },
      {
        question: "How would you design this small system?",
        why: "Checks whether you can turn requirements into components and data.",
        angle:
          "Start with requirements and scale, sketch the data model and the main flow, then name one failure case.",
        basis: "stage",
      },
    ],
    general: [
      {
        category: "Your code",
        question: "Why did you choose that stack, and what did it cost you?",
      },
      { category: "Your code", question: "How do you test your work?" },
      {
        category: "Your code",
        question: "What would break first if usage grew ten times?",
      },
      {
        category: "Fundamentals",
        question: "How does a hash map work, and when is it the wrong choice?",
      },
      {
        category: "Fundamentals",
        question: "What happens between typing a URL and seeing the page?",
      },
      {
        category: "Fundamentals",
        question: "When would you use a queue, a cache, or a database index?",
      },
      {
        category: "Fundamentals",
        question: "What do ACID guarantees mean in practice?",
      },
      {
        category: "Working style",
        question: "How do you review someone else’s pull request?",
      },
      {
        category: "Working style",
        question: "Tell me about a technical decision you disagreed with.",
      },
      {
        category: "Working style",
        question: "How do you learn a new language or framework quickly?",
      },
    ],
    ask: [
      "What does the codebase look like, and how do changes get to production?",
      "What is the hardest technical problem the team has right now?",
      "How are code reviews and on-call handled?",
      "What would I be building in the first month?",
      "How does the team decide what to build next?",
    ],
    checklist: [
      "Ask the recruiter for the format: live coding, take-home or discussion",
      "Solve two timed problems out loud in your interview language",
      "Re-read your own project code so the details are fresh",
      "Prepare one design story and one debugging story",
      "Set up the editor or shared pad you will use",
      "Keep water, paper and a pen nearby",
    ],
  },
  {
    id: "hr",
    step: "03",
    label: "Final HR call",
    title: "The closing conversation",
    line: "Values, motivation and the practical details of an offer.",
    length: "20–40 min",
    who: "HR or hiring manager",
    checks: [
      "Motivation and values",
      "How you work with people",
      "Long-term intent",
      "Offer details and timing",
    ],
    brief:
      "By this point the team usually wants to say yes. HR is checking that your motivation holds, that you will work well with people, and that pay, notice period and start date can be agreed. Be accurate about dates and numbers, and use the call to decide whether the offer is right for you.",
    top: [
      {
        question: "Why do you want to join us?",
        why: "They want to hear that the choice is deliberate, now that you have met the team.",
        angle:
          "Mention something specific you learned in the earlier rounds, and what you want to build here.",
        basis: "stage",
      },
      {
        question: "What are your compensation expectations?",
        why: "This is where the offer is shaped.",
        angle:
          "Give a researched range, ask about the full package, and take time before you accept a number.",
        basis: "stage",
      },
      {
        question: "Tell me about a disagreement with a teammate.",
        why: "The most common behavioural check for how you handle conflict.",
        angle:
          "Situation, what you did, the result, and what you learned. Keep the other person reasonable in the story.",
        basis: "stage",
      },
      {
        question: "Where do you see yourself in a few years?",
        why: "They are checking that the role fits your direction and you are likely to stay.",
        angle:
          "Describe the skills and scope you want to grow into, and how this role leads there.",
        basis: "stage",
      },
      {
        question: "When can you start?",
        why: "Start date and notice period affect the offer and team planning.",
        angle:
          "Give your real notice period and an exact date. Do not promise an earlier date than you can keep.",
        basis: "stage",
      },
    ],
    general: [
      {
        category: "Motivation",
        question: "What matters most to you in a workplace?",
      },
      {
        category: "Motivation",
        question: "Why are you leaving your current role?",
      },
      {
        category: "Motivation",
        question: "What would make you turn this offer down?",
      },
      {
        category: "Behaviour",
        question: "Tell me about a time you failed, and what you did next.",
      },
      {
        category: "Behaviour",
        question: "How do you handle pressure or a tight deadline?",
      },
      {
        category: "Behaviour",
        question: "Describe feedback that was hard to hear.",
      },
      {
        category: "Behaviour",
        question: "What are your strengths, and one real weakness?",
      },
      {
        category: "Offer",
        question: "Do you have other offers or interviews in progress?",
      },
      {
        category: "Offer",
        question: "Are you comfortable with the location and working hours?",
      },
      {
        category: "Offer",
        question: "Is there anything that would stop you from accepting?",
      },
    ],
    ask: [
      "What does the full package include: base, bonus, equity and benefits?",
      "How are performance and pay reviewed, and how often?",
      "What does onboarding look like in the first weeks?",
      "What is the policy on remote work, leave and working hours?",
      "When should I expect a decision, and who will send it?",
    ],
    checklist: [
      "Decide your target, your acceptable range and your walk-away number",
      "Confirm your exact notice period and earliest start date",
      "Prepare two short stories: a conflict and a failure",
      "List what you learned about the team in earlier rounds",
      "Write down your questions about the package and policies",
      "Have your documents and references ready to share",
    ],
  },
];
export function stageGuide(id: StageId) {
  return STAGES.find((stage) => stage.id === id) || STAGES[0];
}

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
// Read the facts stated in an interview invitation. Nothing is guessed: a field stays
// empty unless the email says it.
export function readInvite(email: string): Invite {
  const text = email.replace(/\r/g, "");
  const flat = clean(text);
  // Company words may hold a dot inside ("Acme.io") but never end on one, so the
  // match stops at the end of the sentence.
  const name =
    "([A-Z][\\w&'-]*(?:\\.[\\w&'-]+)*(?: [A-Z][\\w&'-]*(?:\\.[\\w&'-]+)*){0,3})";
  const lead = "(?:for|in|to) (?:the|our|an?) ";
  const named = flat.match(
    new RegExp(
      `\\b${lead}((?:(?! ${lead}).){3,90}?) (?:role|position|opening|vacancy|job)\\b(?: (?:at|with) ${name})?`,
    ),
  );
  const applied = flat.match(
    new RegExp(
      `\\b(?:applying|application|applied) (?:for|to) (?:the |our |an? )?(.{3,90}?) (?:at|with) ${name}`,
    ),
  );
  const role = clean(named?.[1] || applied?.[1] || "");
  const signature = text
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const signoff = signature.findIndex((line) =>
    /^(best|best regards|kind regards|warm regards|regards|thanks|thank you|many thanks|cheers|sincerely)[,!.]?$/i.test(
      line,
    ),
  );
  const after = signoff >= 0 ? signature.slice(signoff + 1, signoff + 4) : [];
  const person = /^[A-Z][a-z'-]+(?: [A-Z][a-z'-]+){0,2}$/;
  const interviewer = after[0] && person.test(after[0]) ? after[0] : "";
  const company = clean(
    named?.[2] ||
      applied?.[2] ||
      after.slice(1).find((line) => /^[A-Z][\w&.' -]{1,40}$/.test(line)) ||
      "",
  ).replace(/[.,]$/, "");
  const minutes = flat.match(/\b(\d{1,3})[- ]?(?:minutes?|mins?)\b/i);
  const hours = flat.match(/\b(\d(?:\.\d)?|one|two)[- ]?hours?\b/i);
  const platform =
    [
      [/microsoft teams|ms teams|\bteams\b/i, "Microsoft Teams"],
      [/\bzoom\b/i, "Zoom"],
      [/google meet|\bmeet\.google\b/i, "Google Meet"],
      [/\bwebex\b/i, "Webex"],
      [/in[- ]person|on[- ]?site|our office/i, "In person"],
      [/phone (call|interview|screen)|by phone|call you on/i, "Phone"],
    ].find(([test]) => (test as RegExp).test(flat))?.[1] || "";
  // The role title can contain words such as "Technical"; keep it out of stage detection.
  const body = role ? flat.split(role).join(" ") : flat;
  const length = minutes
    ? Number(minutes[1])
    : hours
      ? Math.round(
          (hours[1] === "one" ? 1 : hours[1] === "two" ? 2 : Number(hours[1])) *
            60,
        )
      : null;
  const stage: StageId | null =
    /technical (interview|round|call|screen|assessment|discussion)|\bcoding\b|live[- ]cod|pair[- ]program|system design|take[- ]home|hackerrank|codility|coderpad|codesignal/i.test(
      body,
    )
      ? "tech"
      : /\b(final|last) (round|interview|call|stage)|\bhr (round|interview|call|discussion)|\boffer\b|compensation discussion|culture (fit|interview)|values interview/i.test(
            body,
          )
        ? "hr"
        : /recruiter|screening|phone screen|\bintro(ductory)?\b|initial (call|chat|conversation|interview)|first (call|chat|conversation)|get to know/i.test(
              body,
            ) ||
            (length !== null && length <= 20)
          ? "intro"
          : null;
  const tasks = [
    /calendly|book a (time|slot)|schedule a (time|slot)|pick a (time|slot)|choose a (time|slot)/i.test(
      flat,
    ) && "Book your slot with the scheduling link in the invite",
    /job description/i.test(flat) &&
      "Review the job description, as the invite asks",
    /(find out|learn|read) more about us|about us|our website|careers page/i.test(
      flat,
    ) && "Read the company page linked in the invite",
    /(bring|share|send|prepare) .{0,40}(portfolio|resume|résumé|cv|documents|id\b)/i.test(
      flat,
    ) && "Prepare the documents the invite asks for",
  ].filter((task): task is string => !!task);
  return {
    company,
    role,
    stage,
    minutes: length && length >= 5 && length <= 480 ? length : null,
    platform: String(platform),
    interviewer,
    tasks,
  };
}
