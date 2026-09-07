// The one route behind "reorganise the packs". Because a pack is nothing but
// a text column on the card tables, rename, merge and move-these-cards are the
// same UPDATE with three different WHERE clauses:
//
//   from: { pack }, toPack unused by any card  → rename
//   from: { pack }, toPack already has cards   → merge
//   from: { ids },  toPack                     → move those cards
//
// What differs is the auxiliary rows (card_packs, default_card_packs), and
// that decision is planPackMove's — see its comment for the two rules.

import { eq, inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import {
  whiteCards,
  blackCards,
  defaultCardPacks,
  cardPacks,
} from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { planPackMove } from "~~/server/utils/planPackMove";
import { requireAdmin } from "~~/server/utils/session";

const MAX_IDS = 500;

type MoveType = "white" | "black" | "all";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const { from, toPack, type = "all" } = await readBody<{
    from?: { pack?: string; ids?: string[] };
    toPack?: string | null;
    type?: MoveType;
  }>(event);

  // ── Validate ──────────────────────────────────────────────────────────────
  if (toPack !== null && (typeof toPack !== "string" || !toPack.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: "toPack must be a non-empty string, or null to clear the pack",
    });
  }
  const target = toPack === null ? null : toPack.trim();

  const sourcePack = typeof from?.pack === "string" ? from.pack : undefined;
  const ids = Array.isArray(from?.ids) ? [...new Set(from.ids)] : undefined;

  if (!sourcePack && !ids?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "from must carry either a pack name or a non-empty ids array",
    });
  }
  if (ids && ids.length > MAX_IDS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many ids (max ${MAX_IDS})`,
    });
  }
  if (type !== "white" && type !== "black" && type !== "all") {
    throw createError({
      statusCode: 400,
      statusMessage: "type must be 'white', 'black' or 'all'",
    });
  }
  // An id-based move needs one concrete table — ids are only unique per table.
  if (ids && type === "all") {
    throw createError({
      statusCode: 400,
      statusMessage: "type must be 'white' or 'black' when moving by ids",
    });
  }

  // Renaming a pack onto its own name changes nothing.
  if (sourcePack && target === sourcePack) {
    return { moved: { white: 0, black: 0 } };
  }

  const db = useDb();
  const tables: { key: "white" | "black"; table: typeof whiteCards | typeof blackCards }[] =
    type === "all"
      ? [
          { key: "white", table: whiteCards },
          { key: "black", table: blackCards },
        ]
      : [{ key: type, table: cardTable(type) as typeof whiteCards }];

  return db.transaction(async (tx) => {
    const moved = { white: 0, black: 0 };

    // Must be answered BEFORE the update — once the cards land, the target
    // trivially has cards and the rename-vs-merge distinction is gone.
    const targetExisted =
      sourcePack !== undefined && target !== null
        ? (await packHasCards(tx, target)) || (await hasAuxRow(tx, target))
        : false;

    for (const { key, table } of tables) {
      const where = ids
        ? inArray(table.id, ids)
        : sourcePack === undefined
          ? undefined
          : eq(table.pack, sourcePack);

      const rows = await tx
        .update(table)
        .set({ pack: target })
        .where(where)
        .returning({ id: table.id });

      moved[key] = rows.length;
    }

    // Auxiliary rows only ever travel on a whole-pack move.
    if (sourcePack && target !== null) {
      const sourceRetainsCards = await packHasCards(tx, sourcePack);
      const { aux } = planPackMove({ sourceRetainsCards, targetExisted });

      if (aux === "move") {
        await tx
          .update(cardPacks)
          .set({ pack: target })
          .where(eq(cardPacks.pack, sourcePack));
        await tx
          .update(defaultCardPacks)
          .set({ pack: target })
          .where(eq(defaultCardPacks.pack, sourcePack));
      } else if (aux === "drop") {
        await tx.delete(cardPacks).where(eq(cardPacks.pack, sourcePack));
        await tx.delete(defaultCardPacks).where(eq(defaultCardPacks.pack, sourcePack));
      }
    }

    return { moved };
  });
});

/** Does this pack still have a card in either table? */
async function packHasCards(tx: any, pack: string): Promise<boolean> {
  for (const table of [whiteCards, blackCards]) {
    const [row] = await tx
      .select({ id: table.id })
      .from(table)
      .where(eq(table.pack, pack))
      .limit(1);
    if (row) return true;
  }
  return false;
}

/** Is a metadata row or a default flag parked at this key? */
async function hasAuxRow(tx: any, pack: string): Promise<boolean> {
  const [meta] = await tx
    .select({ pack: cardPacks.pack })
    .from(cardPacks)
    .where(eq(cardPacks.pack, pack))
    .limit(1);
  if (meta) return true;

  const [def] = await tx
    .select({ pack: defaultCardPacks.pack })
    .from(defaultCardPacks)
    .where(eq(defaultCardPacks.pack, pack))
    .limit(1);
  return Boolean(def);
}
