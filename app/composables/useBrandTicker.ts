/**
 * Footer ticker items for the brand pages.
 *
 * Stubbed with copy from the design prototype. Real items will come
 * from an aggregation of: recent crownings (from finished games),
 * daily round count (a metrics rollup), upcoming pack drops (from
 * the announcements collection), and so on. See
 * docs/ui-overhaul-future-features.md.
 */
export function useBrandTicker() {
  const items = ref<string[]>([
    "⚡ maxwell crowned @jfrog in Friday Night Wreckage",
    "🎲 4,291 rounds played today",
    "🧪 New deck dropping Thursday: 'Corporate Hell Vol. 2'",
    "🏆 Weekly leader: @groverclev · 42 crowns",
    "💀 You have 2 games waiting on your move",
    "🔥 Season 03 'Last Call' ends in 11 days",
  ]);

  return { items };
}
