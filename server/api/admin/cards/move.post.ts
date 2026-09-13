// Move cards between packs. Three shapes:
//
//   from: { pack | packId }, whole pack  → rename in place, or merge when the
//                                          destination already exists
//   from: { pack | packId }, one type    → those cards move; the pack stays
//                                          while it still holds the other type
//   from: { ids }                        → just those cards
//
// The response's `aux` reports what happened to the source pack itself, which
// the admin client mirrors without re-deriving the rules:
//   "move"  the source pack now carries the destination name (renamed)
//   "drop"  the source pack was merged away; the destination kept its settings
//   "leave" the source pack still exists
//   null    an id move, or cards cleared out of any pack
//
// Since 0012_pack_ids a rename keeps the pack's id, so it no longer breaks a
// lobby that selected the pack. A merge still does: the source id is gone.

import { eq, inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import {
  ensurePackByName,
  findPackId,
  mergePacks,
  packCardCounts,
  renamePack,
} from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";
import { normalizePackText } from "#shared/packMetaText";

const MAX_IDS = 500;

type MoveType = "white" | "black" | "all";
type Aux = "move" | "drop" | "leave" | null;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const { from, toPack, toPackId, type = "all" } = await readBody<{
    from?: { pack?: string; packId?: string; ids?: string[] };
    toPack?: string | null;
    toPackId?: string;
    type?: MoveType;
  }>(event);

  // ── Validate ──────────────────────────────────────────────────────────────
  if (
    toPackId === undefined &&
    toPack !== null &&
    (typeof toPack !== "string" || !toPack.trim())
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "toPack must be a non-empty string, or null to clear the pack",
    });
  }
  const targetName = typeof toPack === "string" ? toPack.trim() : null;
  // A pack named with a stray double space is still found by its exact name;
  // a typed destination that only differs by internal whitespace should still
  // land on it rather than spawn (or collide with) a near-duplicate.
  const normalizedTargetName = targetName ? normalizePackText(targetName) : null;
  const clearing = toPackId === undefined && toPack === null;

  const sourceRef =
    typeof from?.packId === "string" ? from.packId : typeof from?.pack === "string" ? from.pack : undefined;
  const ids = Array.isArray(from?.ids) ? [...new Set(from.ids)] : undefined;

  if (!sourceRef && !ids?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "from must carry either a pack or a non-empty ids array",
    });
  }
  if (sourceRef !== undefined && ids !== undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: "from must carry a pack or an ids array, not both",
    });
  }
  if (ids && ids.length > MAX_IDS) {
    throw createError({ statusCode: 400, statusMessage: `Too many ids (max ${MAX_IDS})` });
  }
  if (type !== "white" && type !== "black" && type !== "all") {
    throw createError({ statusCode: 400, statusMessage: "type must be 'white', 'black' or 'all'" });
  }
  // Card ids are only unique per table.
  if (ids && type === "all") {
    throw createError({
      statusCode: 400,
      statusMessage: "type must be 'white' or 'black' when moving by ids",
    });
  }

  const none = { white: 0, black: 0 };

  return useDb().transaction(async (tx) => {
    // Resolve the destination by id or exact name. `null` with a name means
    // "does not exist yet"; with `toPackId` it is an error.
    let targetId: string | null = null;
    if (toPackId !== undefined) {
      targetId = await findPackId(tx, toPackId);
      if (!targetId) throw createError({ statusCode: 404, statusMessage: "Destination pack not found" });
    } else if (targetName) {
      targetId = await findPackId(tx, targetName);
      if (!targetId && normalizedTargetName !== targetName) {
        targetId = await findPackId(tx, normalizedTargetName!);
      }
    }

    // ── Specific cards ──────────────────────────────────────────────────────
    if (ids) {
      const table = cardTable(type) as typeof whiteCards;
      const dest = clearing ? null : (targetId ?? (await ensurePackByName(tx, normalizedTargetName!)));
      const rows = await tx
        .update(table)
        .set({ packId: dest })
        .where(inArray(table.id, ids))
        .returning({ id: table.id });
      return { moved: { ...none, [type]: rows.length }, aux: null as Aux };
    }

    // ── A whole pack, or one type of it ─────────────────────────────────────
    const sourceId = await findPackId(tx, sourceRef);
    if (!sourceId || sourceId === targetId) return { moved: none, aux: null as Aux };

    const before = await packCardCounts(tx, sourceId);
    const moved =
      type === "all"
        ? before
        : { ...none, [type]: before[type] };
    const tables = type === "all" ? [whiteCards, blackCards] : [cardTable(type) as typeof whiteCards];

    if (clearing) {
      for (const table of tables) {
        await tx.update(table).set({ packId: null }).where(eq(table.packId, sourceId));
      }
      return { moved, aux: null as Aux };
    }

    const otherType = type === "white" ? "black" : "white";
    const sourceRetainsCards = type !== "all" && before[otherType] > 0;

    if (sourceRetainsCards) {
      const dest = targetId ?? (await ensurePackByName(tx, normalizedTargetName!));
      for (const table of tables) {
        await tx.update(table).set({ packId: dest }).where(eq(table.packId, sourceId));
      }
      return { moved, aux: "leave" as Aux };
    }

    if (targetId) {
      await mergePacks(tx, [sourceId], targetId);
      return { moved, aux: "drop" as Aux };
    }

    await renamePack(tx, sourceId, normalizedTargetName!);
    return { moved, aux: "move" as Aux };
  });
});
