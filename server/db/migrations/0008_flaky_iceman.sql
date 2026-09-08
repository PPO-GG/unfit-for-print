CREATE TABLE "issue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"lobby_code" text,
	"user_id" uuid,
	"app_version" text NOT NULL,
	"platform" text,
	"route" text,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"first_app_version" text,
	"notified_at" timestamp with time zone,
	CONSTRAINT "issue_groups_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
ALTER TABLE "issue_events" ADD CONSTRAINT "issue_events_group_id_issue_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."issue_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_events_group_created_idx" ON "issue_events" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "issue_events_lobby_code_idx" ON "issue_events" USING btree ("lobby_code");--> statement-breakpoint
CREATE INDEX "issue_groups_last_seen_idx" ON "issue_groups" USING btree ("last_seen" DESC NULLS LAST);