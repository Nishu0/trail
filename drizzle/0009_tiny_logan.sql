CREATE TABLE "trail_employer_exclusions" (
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] NOT NULL,
	"domains" text[] NOT NULL,
	"reason" text NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_employer_exclusions_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "trail_employer_exclusions" ADD CONSTRAINT "trail_employer_exclusions_workspace_id_trail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."trail_workspaces"("id") ON DELETE cascade ON UPDATE no action;