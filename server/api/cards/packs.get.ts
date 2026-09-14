// server/api/cards/packs.get.ts
//
// Per-type pack roster with total/active card counts.
//
// Unauthenticated, so by default it reports every pack — including ones whose
// cards are all deactivated, which the admin Cards Manager needs in order to
// toggle them back on. Public callers should pass `activeOnly=1`: a pack an
// admin has switched off is not meant to be advertised, and filtering it out
// here keeps its name out of the response rather than relying on each client
// to drop it after the fact.

import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards, cardPacks } from "~~/server/db/schema";
import { packStats, type PackStat } from "~~/server/utils/packStats";

export default defineEventHandler(async (event) => {
  const activeOnly = getQuery(event).activeOnly !== undefined;
  const [white, black, meta] = await Promise.all([
    packStats(whiteCards),
    packStats(blackCards),
    // `pack` is the pack's name under its pre-id key, so consumers that match
    // meta rows to stats by name keep working; `id` is what new code keys on.
    // `legacyKey` is the retired `card_packs.pack` key (null for packs created
    // after 0012_pack_ids): pre-migration lobbies stored it in
    // `settings.cardPacks`, and the host's settings UI maps it back to an id.
    useDb()
      .select({
        id: cardPacks.id,
        pack: cardPacks.name,
        legacyKey: cardPacks.pack,
        series: cardPacks.series,
        description: cardPacks.description,
        official: cardPacks.official,
        nsfw: cardPacks.nsfw,
      })
      .from(cardPacks),
  ]);

  // Filtered per card type: a pack live in white but fully off in black drops
  // out of `black` only, which matches what every consumer already computed
  // client-side by summing `active`.
  const visible = (stats: PackStat[]) =>
    activeOnly ? stats.filter((p) => p.active > 0) : stats;

  return { white: visible(white), black: visible(black), meta };
});
