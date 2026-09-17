CREATE TYPE "public"."trail_application_channel" AS ENUM('Email', 'X', 'Job form');--> statement-breakpoint
CREATE TYPE "public"."trail_application_stage" AS ENUM('Saved', 'Applied', 'Interview', 'Offer', 'Archived');--> statement-breakpoint
CREATE TYPE "public"."trail_project_build_mode" AS ENUM('solo', 'team');--> statement-breakpoint
CREATE TYPE "public"."trail_draft_mode" AS ENUM('starter', 'ai');--> statement-breakpoint
CREATE TYPE "public"."trail_job_source" AS ENUM('YC', 'X', 'LinkedIn', 'Other');--> statement-breakpoint
CREATE TYPE "public"."trail_resume_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "trail_activity" (
	"workspace_id" uuid NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "trail_activity_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_applications" (
	"workspace_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"stage" "trail_application_stage" DEFAULT 'Saved' NOT NULL,
	"channel" "trail_application_channel",
	"applied_at" timestamp with time zone,
	"follow_up" date,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_applications_workspace_id_job_id_pk" PRIMARY KEY("workspace_id","job_id")
);
--> statement-breakpoint
CREATE TABLE "trail_companies" (
	"workspace_id" uuid NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"website" text NOT NULL,
	"repo" text NOT NULL,
	"color" text NOT NULL,
	"initials" text NOT NULL,
	"notes" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_companies_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_company_people" (
	"workspace_id" uuid NOT NULL,
	"company_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"linkedin" text NOT NULL,
	"x" text NOT NULL,
	"evidence" text NOT NULL,
	CONSTRAINT "trail_company_people_workspace_id_company_id_position_pk" PRIMARY KEY("workspace_id","company_id","position")
);
--> statement-breakpoint
CREATE TABLE "trail_drafts" (
	"workspace_id" uuid NOT NULL,
	"id" text NOT NULL,
	"job_id" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"mode" "trail_draft_mode" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_drafts_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_jobs" (
	"workspace_id" uuid NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"source" "trail_job_source" NOT NULL,
	"url" text NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "trail_jobs_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_profiles" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"skills" text DEFAULT '' NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"github" text DEFAULT '' NOT NULL,
	"devpost" text DEFAULT '' NOT NULL,
	"devfolio" text DEFAULT '' NOT NULL,
	"ethglobal" text DEFAULT '' NOT NULL,
	"writing" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_projects" (
	"workspace_id" uuid NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"description" text NOT NULL,
	"stack" text NOT NULL,
	"github_url" text,
	"build_mode" "trail_project_build_mode",
	"contribution" text,
	"imported_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_projects_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content" "bytea",
	"content_type" text,
	"size_bytes" integer,
	"extracted_text" text DEFAULT '' NOT NULL,
	"extracted_fields" jsonb,
	"model" text,
	"status" "trail_resume_status" DEFAULT 'processing' NOT NULL,
	"error" text,
	"active" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth_subject" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_users_auth_subject_unique" UNIQUE("auth_subject")
);
--> statement-breakpoint
CREATE TABLE "trail_workspaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"last_discovery" timestamp with time zone,
	"legacy_imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trail_activity" ADD CONSTRAINT "trail_activity_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_applications" ADD CONSTRAINT "trail_applications_workspace_id_job_id_trail_jobs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","job_id") REFERENCES "public"."trail_jobs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_companies" ADD CONSTRAINT "trail_companies_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_company_people" ADD CONSTRAINT "trail_company_people_workspace_id_company_id_trail_companies_workspace_id_id_fk" FOREIGN KEY ("workspace_id","company_id") REFERENCES "public"."trail_companies"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_drafts" ADD CONSTRAINT "trail_drafts_workspace_id_job_id_trail_jobs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","job_id") REFERENCES "public"."trail_jobs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_jobs" ADD CONSTRAINT "trail_jobs_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_profiles" ADD CONSTRAINT "trail_profiles_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_projects" ADD CONSTRAINT "trail_projects_workspace_id_trail_profiles_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_profiles"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_resumes" ADD CONSTRAINT "trail_resumes_workspace_id_trail_profiles_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_profiles"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_workspaces" ADD CONSTRAINT "trail_workspaces_owner_id_trail_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."trail_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trail_activity_time_idx" ON "trail_activity" USING btree ("workspace_id","at");--> statement-breakpoint
CREATE INDEX "trail_applications_followup_idx" ON "trail_applications" USING btree ("workspace_id","stage","follow_up");--> statement-breakpoint
CREATE INDEX "trail_companies_name_idx" ON "trail_companies" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "trail_drafts_job_idx" ON "trail_drafts" USING btree ("workspace_id","job_id");--> statement-breakpoint
CREATE INDEX "trail_jobs_source_idx" ON "trail_jobs" USING btree ("workspace_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "trail_jobs_source_url_unique" ON "trail_jobs" USING btree ("workspace_id","url") WHERE "trail_jobs"."url" <> '' AND "trail_jobs"."sample" = false;--> statement-breakpoint
CREATE INDEX "trail_resumes_workspace_idx" ON "trail_resumes" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trail_resumes_active_unique" ON "trail_resumes" USING btree ("workspace_id") WHERE "trail_resumes"."active" = true;--> statement-breakpoint
CREATE INDEX "trail_workspaces_owner_idx" ON "trail_workspaces" USING btree ("owner_id");