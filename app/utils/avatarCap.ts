/** One avatar in the compact top bar: a 28px avatar plus its 4px gap. */
const AVATAR_SLOT_PX = 32;
/** What a phone shows, and the floor for everything else. */
const MIN_AVATARS = 5;

/**
 * How many avatars the compact top bar shows before collapsing the rest into
 * a "+N" chip.
 *
 * `barWidthPx` is null on phones, which keep the fixed five. A tablet passes
 * its avatar strip's measured width and shows as many as fit, keeping one
 * slot for the chip when not everyone does. Never fewer than five, so a strip
 * that has not been measured yet (0px) still shows the phone's row.
 */
export function visibleAvatarCount(total: number, barWidthPx: number | null): number {
  if (barWidthPx === null) return Math.min(total, MIN_AVATARS);
  const slots = Math.max(MIN_AVATARS, Math.floor(barWidthPx / AVATAR_SLOT_PX));
  if (total <= slots) return total;
  return Math.max(MIN_AVATARS, slots - 1);
}
