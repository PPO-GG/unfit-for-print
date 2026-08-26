CREATE TABLE "black_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"pack" text,
	"active" boolean DEFAULT true NOT NULL,
	"pick" integer DEFAULT 1 NOT NULL,
	"times_played" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decorations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text NOT NULL,
	"category" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"free_for_all" boolean DEFAULT false NOT NULL,
	"discord_sku_id" text,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image_key" text,
	"image_format" text
);
--> statement-breakpoint
CREATE TABLE "lobbies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"lobby_name" text,
	"discord_instance_id" text,
	"discord_channel_id" text,
	"vc_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lobbies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lobby_id" uuid NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"is_host" boolean DEFAULT false NOT NULL,
	"player_type" text DEFAULT 'player' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"card_type" text NOT NULL,
	"reason" text NOT NULL,
	"reported_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitter_id" uuid NOT NULL,
	"submitter_name" text NOT NULL,
	"card_type" text NOT NULL,
	"text" text NOT NULL,
	"pick" integer,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"upvoter_ids" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_decorations" (
	"user_id" uuid NOT NULL,
	"decoration_id" text NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "user_decorations_user_id_decoration_id_pk" PRIMARY KEY("user_id","decoration_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"active_decoration" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_user_id_unique" UNIQUE("discord_user_id")
);
--> statement-breakpoint
CREATE TABLE "white_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"pack" text,
	"active" boolean DEFAULT true NOT NULL,
	"times_played" integer DEFAULT 0 NOT NULL,
	"times_won" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lobbies" ADD CONSTRAINT "lobbies_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_lobby_id_lobbies_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_decorations" ADD CONSTRAINT "user_decorations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_decorations" ADD CONSTRAINT "user_decorations_decoration_id_decorations_id_fk" FOREIGN KEY ("decoration_id") REFERENCES "public"."decorations"("id") ON DELETE cascade ON UPDATE no action;