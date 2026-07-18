/**
 * Player stats shown in the BrandTopBar profile dropdown + the
 * trigger's rank sub-line.
 *
 * Currently stubbed with values from the design prototype. Once the
 * metrics pipeline lands (see docs/ui-overhaul-future-features.md),
 * swap the body to hit a real endpoint keyed on
 * `userStore.user?.$id` — e.g. `/api/me/stats`.
 *
 * Returns `null`-able values so the UI can skip fields we don't know
 * yet (e.g. hide the rank line for brand-new players).
 */
export interface BrandPlayerStats {
  played: number | null;
  rank: number | null;
  crowned: number | null;
}

export function useBrandPlayerStats() {
  const stats = readonly(ref<BrandPlayerStats>({
    played: 128,
    rank: 47,
    crowned: 22,
  }));
  return { stats };
}
