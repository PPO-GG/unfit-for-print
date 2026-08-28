import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards, defaultCardPacks } from "~~/server/db/schema";
import { packStats } from "~~/server/utils/packStats";

// Bootstrap fallback used until an admin explicitly configures defaults via
// the toggle-default-pack endpoint (keeps pre-existing lobby-creation
// behavior unchanged for fresh installs).
const FALLBACK_DEFAULT_PACKS = [
  "CAH Base Set",
  "CAH: Blue Box Expansion",
  "CAH: Green Box Expansion",
  "CAH: Red Box Expansion",
];

export default defineEventHandler(async () => {
  const db = useDb();
  const [configured, white, black] = await Promise.all([
    db.select().from(defaultCardPacks),
    packStats(whiteCards),
    packStats(blackCards),
  ]);

  const configuredNames = configured.length
    ? configured.map((r) => r.pack)
    : FALLBACK_DEFAULT_PACKS;

  const activePacks = new Set(
    [...white, ...black].filter((p) => p.active > 0).map((p) => p.pack),
  );

  return { packs: configuredNames.filter((pack) => activePacks.has(pack)) };
});
