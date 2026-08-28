ALTER TABLE "black_cards" ALTER COLUMN "text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "white_cards" ALTER COLUMN "text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "black_cards" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "black_cards" ADD COLUMN "image_format" text;--> statement-breakpoint
ALTER TABLE "black_cards" ADD COLUMN "attachment" jsonb;--> statement-breakpoint
ALTER TABLE "white_cards" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "white_cards" ADD COLUMN "image_format" text;--> statement-breakpoint
ALTER TABLE "white_cards" ADD COLUMN "attachment" jsonb;