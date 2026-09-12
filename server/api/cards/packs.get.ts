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
    // Display name and series ride along so public callers can render a pack
    // the same way the admin does. The Labs gallery showed raw pack keys for
    // its whole life because this was the only roster it had, and there is no
    // unauthenticated counterpart to /api/admin/cards/pack-meta. Scoped to the
    // two labelling columns: the rest of card_packs is admin-only detail.
    useDb()
      .select({
        pack: cardPacks.pack,
        displayName: cardPacks.displayName,
        series: cardPacks.series,
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
