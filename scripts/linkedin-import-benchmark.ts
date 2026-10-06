import { config } from "dotenv";
import { linkedinRepository } from "../src/lib/linkedin-store";
import { closeDatabase } from "../src/db/client";
import type { ProfileReview, ResearchInsight } from "../src/lib/linkedin-types";
config({ path: ".env.local", quiet: true });
const profiles: ProfileReview[] = await Bun.file(
  "research/linkedin-benchmark.json",
).json();
const patterns = [
  [
    "specific-system",
    "Name the system",
    "Concrete systems and flows make the work legible: credit marketplace, pool creation, policy pipelines and inference verification.",
  ],
  [
    "ownership",
    "Make ownership clear",
    "State which parts you built and which you co-led. Team scope and personal contribution should be distinguishable.",
  ],
  [
    "measured-outcome",
    "Add evidence with a baseline",
    "Use verified scale or before-and-after figures with a time window. These peer metrics are self-reported, not numbers to borrow.",
  ],
  [
    "technical-depth",
    "Explain the engineering decision",
    "Connect named technologies and design choices to the problem they solved. Avoid a stack-only description.",
  ],
  [
    "collaboration",
    "Preserve the team contribution",
    "Shared work can be strong evidence. Name co-led delivery without implying sole ownership or unsupported team size.",
  ],
  [
    "proof-links",
    "Make the work inspectable",
    "A repository, demo or architecture write-up lets a reader inspect the work. Use only material you can share publicly.",
  ],
];
const insights: ResearchInsight[] = patterns.map(([signal, title, detail]) => ({
  title,
  detail,
  count: profiles.filter((profile) => profile.signals.includes(signal)).length,
  urls: profiles
    .filter((profile) => profile.signals.includes(signal))
    .slice(0, 3)
    .map((profile) => profile.url),
}));
const methodology =
  "100 unique LinkedIn profiles reviewed across Move/on-chain credit, ZK, fintech, early-stage engineering, DeFi infrastructure and product engineering. Exa supplied indexed profile text, which may be incomplete or stale and includes enrichment. AI-assisted reviews focus on self-authored engineering descriptions, not employer funding/revenue or follower counts. Every displayed quote is checked against the retrieved source and capped at 24 words. Metrics and achievements are self-reported; this benchmark does not establish hiring success. Sparse writing examples are retained and labelled as limitations, not presented as best practices.";
try {
  const repo = await linkedinRepository();
  await repo.saveResearch(profiles, insights, methodology);
  const state = await repo.getState();
  if (!state.profileUrl)
    await repo.saveUrl("https://www.linkedin.com/in/Nishu0");
  const qiroFacts =
    "I worked at Qiro Finance. I built the Move smart contracts end to end for the credit marketplace, including pool creation and investment flows. I co-led the full-stack credit marketplace and underwriting network with one coworker on the full-stack side. I built the underwriting policy pipelines. I built the end-to-end underwriting inference proof workflow with Ritual infrastructure: submitting public inputs and encrypted private data for verification and ZK proof generation. I used Aptos Move and worked on integrations for Aptos and multiple EVM chains, including Polygon and Base. Do not mention joining as an intern, conversion to full-time, or founding engineer status. Keep the job title Software Engineer. No verified performance, financial or adoption metrics have been supplied.";
  const seeds = [
    {
      id: "qiro-experience",
      kind: "experience" as const,
      label: "Qiro Finance · Experience",
      company: "Qiro Finance",
      title: "Software Engineer",
      dates: "Jul 2024 – Dec 2025",
      currentText: "",
      facts: qiroFacts,
    },
    {
      id: "lunacards-experience",
      kind: "experience" as const,
      label: "Lunacards · Experience",
      company: "Lunacards",
      title: "Software Engineer",
      dates: "Jan 2026 – Present",
      currentText: "",
      facts:
        "Details have not been supplied yet. Do not invent projects or achievements for this role.",
    },
    {
      id: "headline",
      kind: "headline" as const,
      label: "Headline",
      company: "",
      title: "",
      dates: "",
      currentText: "",
      facts:
        "Engineering work at Qiro Finance: Aptos Move smart contracts, full-stack credit marketplace and underwriting network, Ritual-based underwriting inference proof workflow, Aptos/Polygon/Base integrations. Current headline has not been read; ask for it before claiming an exact replacement.",
    },
    {
      id: "about",
      kind: "about" as const,
      label: "About",
      company: "",
      title: "",
      dates: "",
      currentText: "",
      facts:
        qiroFacts +
        " Current About text is unavailable. Do not claim you reviewed it.",
    },
  ];
  for (const section of seeds)
    if (!state.sections.some((old) => old.id === section.id))
      await repo.saveSection(section, undefined, "user_screenshot");
  await repo.saveSync(
    "https://www.linkedin.com/in/Nishu0",
    "unavailable",
    "",
    "LinkedIn returned a sign-in page during the public refresh. Qiro/Lunacards role metadata and empty descriptions come from your supplied screenshot. Headline and About text remain unknown. Paste the current text after editing LinkedIn; confirmed sections are never overwritten by public-index data.",
  );
  console.log(
    "Saved 100 evidence-checked profile reviews and user-supplied Qiro facts to Neon. Other workspace data was not changed.",
  );
} finally {
  await closeDatabase();
}
