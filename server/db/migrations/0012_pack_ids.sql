-- Pack ids. Adds and backfills; deletes nothing. The retired columns
-- (cards.pack, card_packs.pack, card_packs.display_name, default_card_packs)
-- are dropped by a later migration once this has been verified on live data.
ALTER TABLE "card_packs" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "card_packs" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "card_packs" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "white_cards" ADD COLUMN "pack_id" uuid;--> statement-breakpoint
ALTER TABLE "black_cards" ADD COLUMN "pack_id" uuid;--> statement-breakpoint
-- 1. A registry row for every pack referenced anywhere. Most packs had none.
INSERT INTO "card_packs" ("pack")
SELECT DISTINCT "p" FROM (
  SELECT "pack" AS "p" FROM "white_cards"
  UNION SELECT "pack" FROM "black_cards"
  UNION SELECT "pack" FROM "default_card_packs"
) AS "refs"
WHERE "p" IS NOT NULL
ON CONFLICT ("pack") DO NOTHING;--> statement-breakpoint
-- 2. One name per pack: the display name when set, else the raw key. When two
--    packs want the same name, the pack whose raw key already IS that name
--    keeps it; the others fall through to steps 3-4.
UPDATE "card_packs" AS "c" SET "name" = "ranked"."candidate"
FROM (
  SELECT "pack", "candidate",
    row_number() OVER (PARTITION BY "candidate" ORDER BY ("candidate" = "pack") DESC, "pack") AS "rn"
  FROM (
    SELECT "pack", coalesce(nullif(btrim("display_name"), ''), "pack") AS "candidate"
    FROM "card_packs"
  ) AS "named"
) AS "ranked"
WHERE "c"."pack" = "ranked"."pack" AND "ranked"."rn" = 1;--> statement-breakpoint
-- 3. Losers take their raw key, unless another pack's display name took it.
UPDATE "card_packs" AS "c" SET "name" = "c"."pack"
WHERE "c"."name" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "card_packs" AS "o" WHERE "o"."name" = "c"."pack");--> statement-breakpoint
-- 4. Still colliding: disambiguate with a short id suffix.
UPDATE "card_packs" SET "name" = "pack" || ' (' || left("id"::text, 8) || ')' WHERE "name" IS NULL;--> statement-breakpoint
UPDATE "card_packs" SET "is_default" = true WHERE "pack" IN (SELECT "pack" FROM "default_card_packs");--> statement-breakpoint
UPDATE "white_cards" AS "w" SET "pack_id" = "c"."id" FROM "card_packs" AS "c" WHERE "w"."pack" = "c"."pack";--> statement-breakpoint
UPDATE "black_cards" AS "b" SET "pack_id" = "c"."id" FROM "card_packs" AS "c" WHERE "b"."pack" = "c"."pack";--> statement-breakpoint
ALTER TABLE "card_packs" DROP CONSTRAINT "card_packs_pkey";--> statement-breakpoint
ALTER TABLE "card_packs" ALTER COLUMN "pack" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "card_packs" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "card_packs" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "card_packs" ADD CONSTRAINT "card_packs_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "white_cards" ADD CONSTRAINT "white_cards_pack_id_card_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "card_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "black_cards" ADD CONSTRAINT "black_cards_pack_id_card_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "card_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "white_cards_pack_id_idx" ON "white_cards" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "black_cards_pack_id_idx" ON "black_cards" USING btree ("pack_id");
