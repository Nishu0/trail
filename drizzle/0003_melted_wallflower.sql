CREATE TYPE "public"."trail_discovery_status" AS ENUM('complete', 'unavailable', 'not_configured');--> statement-breakpoint
CREATE TABLE "trail_discovery_sources" (
	"workspace_id" uuid NOT NULL,
	"source" "trail_job_source" NOT NULL,
	"status" "trail_discovery_status" NOT NULL,
	"query" text NOT NULL,
	"checked" integer NOT NULL,
	"matched" integer NOT NULL,
	"imported" integer NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"message" text NOT NULL,
	CONSTRAINT "trail_discovery_sources_workspace_id_source_pk" PRIMARY KEY("workspace_id","source")
);
--> statement-breakpoint
ALTER TABLE "trail_discovery_sources" ADD CONSTRAINT "trail_discovery_sources_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;