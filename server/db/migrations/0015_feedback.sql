CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_ref" uuid NOT NULL,
	"rating" smallint,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"message" text,
	"source" text NOT NULL,
	"user_id" uuid,
	"lobby_code" text,
	"games_completed_hint" integer,
	"platform" text,
	"app_version" text NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_client_ref_unique" UNIQUE("client_ref"),
	CONSTRAINT "feedback_rating_range" CHECK ("feedback"."rating" IS NULL OR "feedback"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at" DESC NULLS LAST);