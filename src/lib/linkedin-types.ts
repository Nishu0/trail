import { z } from "zod";
export const sectionInput = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  kind: z.enum(["headline", "about", "experience"]),
  company: z.string().max(200).default(""),
  title: z.string().max(200).default(""),
  dates: z.string().max(200).default(""),
  currentText: z.string().max(12000),
  facts: z.string().max(16000).default(""),
});
export type LinkedInSection = z.infer<typeof sectionInput> & {
  version: number;
  source: string;
  updatedAt: string;
};
export type ProfileReview = {
  name: string;
  url: string;
  cohort: string;
  query: string;
  checkedAt: string;
  summary: string;
  takeaway: string;
  evidence: string;
  signals: string[];
  caution: string;
};
export type ResearchInsight = {
  title: string;
  detail: string;
  count: number;
  urls: string[];
};
export type ResearchRun = {
  id: string;
  status: string;
  requestedCount: number;
  reviewedCount: number;
  methodology: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  insights: ResearchInsight[];
};
export type Revision = {
  id: string;
  sectionId: string;
  baseVersion: number;
  beforeText: string;
  afterText: string;
  rationale: string;
  supportingFacts: string[];
  missingMetrics: string[];
  status: string;
  createdAt: string;
};
export type TuningMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sectionId: string | null;
  createdAt: string;
  revisions: Revision[];
};
export type LinkedInTuningState = {
  profileUrl: string;
  lastCheckedAt: string | null;
  syncStatus: string;
  syncNote: string;
  sections: LinkedInSection[];
  messages: TuningMessage[];
  research: ResearchRun | null;
};
export const tuningOutput = z.object({
  reply: z.string().max(16000),
  revisions: z
    .array(
      z.object({
        sectionId: z.string(),
        afterText: z.string().max(12000),
        rationale: z.string().max(3000),
        supportingFacts: z.array(z.string().max(2000)).max(12),
        missingMetrics: z.array(z.string().max(500)).max(8),
      }),
    )
    .max(4),
});
