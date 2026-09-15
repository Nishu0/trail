import { z } from "zod";
const text = z.string().max(20000);
export const link = z.union([
  z.literal(""),
  z
    .url()
    .refine(
      (s) => ["https:", "http:"].includes(new URL(s).protocol),
      "Use an HTTP or HTTPS link",
    ),
]);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)));
export const projectSchema = z
  .object({
    id: text,
    name: z.string().trim().min(1).max(250),
    platform: text,
    url: link,
    description: text,
    stack: text,
    githubUrl: link.optional(),
    websiteUrl: link.optional(),
    repositoryCandidates: z.array(link).max(10).optional(),
    buildMode: z.enum(["", "solo", "team"]).optional(),
    contribution: text.optional(),
    importedAt: z.iso.datetime().optional(),
  })
  .refine(
    (project) => project.buildMode !== "team" || !!project.contribution?.trim(),
    {
      message: "Tell us what you personally built on this team project.",
      path: ["contribution"],
    },
  );
export const profileSchema = z.object({
  name: text,
  headline: text,
  bio: text,
  skills: text,
  target: text,
  location: text,
  github: text,
  devpost: link,
  devfolio: link,
  ethglobal: link,
  writing: text,
  projects: z.array(projectSchema).max(40),
  resume: z
    .object({
      name: z.string().max(250),
      text: z.string().max(60000),
      id: z.uuid().optional(),
      fileStored: z.boolean().optional(),
      uploadedAt: z.iso.datetime(),
    })
    .optional(),
});
export const jobSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  source: z.enum(["YC", "X", "LinkedIn", "Other"]),
  url: link,
  description: text,
  location: text,
  tags: z.array(z.string().max(100)).max(30),
  notes: text,
});
export const companySchema = z.object({
  name: z.string().min(1).max(200),
  category: text,
  description: text,
  website: link,
  logoUrl: link.optional(),
  logoSource: link.optional(),
  repo: z.string().max(200),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  initials: text,
  notes: text,
  people: z
    .array(
      z.object({
        name: text,
        role: text,
        linkedin: link,
        x: link,
        evidence: link,
      }),
    )
    .max(30),
});
export const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("profile"), profile: profileSchema }),
  z.object({
    action: z.literal("project"),
    project: projectSchema,
    devfolio: link.optional(),
  }),
  z.object({ action: z.literal("delete-project"), id: text }),
  z.object({ action: z.literal("add-job"), job: jobSchema }),
  z.object({
    action: z.literal("job"),
    id: text,
    stage: z.enum(["Saved", "Applied", "Interview", "Offer", "Archived"]),
    channel: z.enum(["Email", "X", "Job form"]).optional(),
    followUp: z.union([date, z.literal("")]).optional(),
    notes: text.optional(),
  }),
  z.object({
    action: z.literal("company"),
    id: text.optional(),
    company: companySchema,
  }),
  z.object({ action: z.literal("draft"), id: text, subject: text, body: text }),
  z.object({ action: z.literal("clear-samples") }),
  z.object({ action: z.literal("snooze"), id: text, followUp: date }),
]);
