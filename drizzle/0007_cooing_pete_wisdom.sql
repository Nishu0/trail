CREATE TABLE "trail_brand_assets" (
	"url" text PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trail_companies" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "trail_companies" ADD COLUMN "logo_source" text;--> statement-breakpoint
ALTER TABLE "trail_jobs" ADD COLUMN "company_website" text;--> statement-breakpoint
ALTER TABLE "trail_jobs" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "trail_jobs" ADD COLUMN "logo_source" text;--> statement-breakpoint
ALTER TABLE "trail_jobs" ADD COLUMN "health" jsonb;