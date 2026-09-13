import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards, cardPacks } from "~~/server/db/schema";
import { packStats } from "~~/server/utils/packStats";

// Returns pack **ids** — this list is written straight into a new lobby's
// `settings.cardPacks`, and an id survives the pack being renamed.
//
// Bootstrap fallback used until an admin marks defaults (keeps lobby creation
// working on a fresh install). Matched by name, then handed out as ids.
const FALLBACK_DEFAULT_PACKS = [
  "CAH Base Set",
  "CAH: Blue Box Expansion",
  "CAH: Green Box Expansion",
  "CAH: Red Box Expansion",
];

export default defineEventHandler(async () => {
  const db = useDb();
  const [configured, white, black] = await Promise.all([
    db.select({ id: cardPacks.id }).from(cardPacks).where(eq(cardPacks.isDefault, true)),
    packStats(whiteCards),
    packStats(blackCards),
  ]);

  const active = [...white, ...black].filter((p) => p.active > 0);
  const activeIds = new Set(active.map((p) => p.packId));

  if (configured.length > 0) {
    return { packs: configured.map((r) => r.id).filter((id) => activeIds.has(id)) };
  }

  const idByName = new Map(active.map((p) => [p.pack, p.packId]));
  const fallback = FALLBACK_DEFAULT_PACKS.map((name) => idByName.get(name)).filter(
    (id): id is string => Boolean(id),
  );
  if (fallback.length > 0) return { packs: fallback };

  const nameById = new Map(active.map((p) => [p.packId, p.pack]));
  return {
    packs: [...nameById.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id]) => id),
  };
});
