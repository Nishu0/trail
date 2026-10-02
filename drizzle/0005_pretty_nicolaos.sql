CREATE TABLE "trail_linkedin_messages" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"section_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_linkedin_messages_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_linkedin_profiles" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"profile_url" text DEFAULT '' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"sync_status" text DEFAULT 'not_checked' NOT NULL,
	"sync_note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_linkedin_research_profiles" (
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"cohort" text NOT NULL,
	"query" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	"takeaway" text NOT NULL,
	"evidence" text NOT NULL,
	"signals" text[] NOT NULL,
	"caution" text NOT NULL,
	CONSTRAINT "trail_linkedin_research_profiles_workspace_id_run_id_url_pk" PRIMARY KEY("workspace_id","run_id","url")
);
--> statement-breakpoint
CREATE TABLE "trail_linkedin_research_runs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" text NOT NULL,
	"requested_count" integer DEFAULT 100 NOT NULL,
	"reviewed_count" integer DEFAULT 0 NOT NULL,
	"methodology" text NOT NULL,
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "trail_linkedin_research_runs_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_linkedin_revisions" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"section_id" text NOT NULL,
	"before_text" text NOT NULL,
	"after_text" text NOT NULL,
	"rationale" text NOT NULL,
	"supporting_facts" text[] NOT NULL,
	"missing_metrics" text[] NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_linkedin_revisions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_linkedin_sections" (
	"workspace_id" uuid NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"dates" text DEFAULT '' NOT NULL,
	"current_text" text DEFAULT '' NOT NULL,
	"facts" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_linkedin_sections_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "trail_linkedin_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"profile_url" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trail_linkedin_messages" ADD CONSTRAINT "trail_linkedin_messages_workspace_id_trail_linkedin_profiles_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_linkedin_profiles"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_linkedin_profiles" ADD CONSTRAINT "trail_linkedin_profiles_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_linkedin_research_profiles" ADD CONSTRAINT "trail_linkedin_research_profiles_workspace_id_run_id_trail_linkedin_research_runs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."trail_linkedin_research_runs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_linkedin_research_runs" ADD CONSTRAINT "trail_linkedin_research_runs_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_linkedin_revisions" ADD CONSTRAINT "trail_linkedin_revisions_workspace_id_message_id_trail_linkedin_messages_workspace_id_id_fk" FOREIGN KEY ("workspace_id","message_id") REFERENCES "public"."trail_linkedin_messages"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_linkedin_revisions" ADD CONSTRAINT "trail_linkedin_revisions_workspace_id_section_id_trail_linkedin_sections_workspace_id_id_fk" FOREIGN KEY ("workspace_id","section_id") REFERENCES "public"."trail_linkedin_sections"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_linkedin_sections" ADD CONSTRAINT "trail_linkedin_sections_workspace_id_trail_linkedin_profiles_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_linkedin_profiles"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_linkedin_snapshots" ADD CONSTRAINT "trail_linkedin_snapshots_workspace_id_trail_linkedin_profiles_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_linkedin_profiles"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trail_linkedin_messages_time_idx" ON "trail_linkedin_messages" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "trail_linkedin_research_time_idx" ON "trail_linkedin_research_runs" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "trail_linkedin_snapshot_time_idx" ON "trail_linkedin_snapshots" USING btree ("workspace_id","checked_at");