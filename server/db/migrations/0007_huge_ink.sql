CREATE TABLE "card_packs" (
	"pack" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"description" text,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"official" boolean DEFAULT false NOT NULL,
	"nsfw" boolean DEFAULT false NOT NULL
);
