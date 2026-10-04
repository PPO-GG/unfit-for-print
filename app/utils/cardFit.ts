/**
 * Card sizing for the compact layout.
 *
 * BlackCard/WhiteCard size themselves as
 *   width = clamp(10rem, 12vw, 18rem) × scale/100, height = width × 4/3
 * so the only way to make a card fit a slot is to pick `scale`. These helpers
 * pick the largest scale that fits the measured slot, which is what keeps the
 * prompt and the hand both on screen on a short phone. Text inside the card is
 * fitted separately by useFitText, so long prompts shrink their text, not the
 * layout.
 */
const BASE_MIN_REM = 10;
const BASE_VW = 0.12;
const BASE_MAX_REM = 18;
const CARD_ASPECT = 4 / 3;

export function cardBaseWidthPx(remPx: number, viewportWidth: number): number {
  return Math.min(
    Math.max(BASE_MIN_REM * remPx, BASE_VW * viewportWidth),
    BASE_MAX_REM * remPx,
  );
}

export function fitCardScale(
  boxWidth: number,
  boxHeight: number,
  baseWidthPx: number,
  { min = 50, max = 200 }: { min?: number; max?: number } = {},
): number {
  if (!(boxWidth > 0) || !(boxHeight > 0) || !(baseWidthPx > 0)) return min;
  const byWidth = boxWidth / baseWidthPx;
  const byHeight = boxHeight / (baseWidthPx * CARD_ASPECT);
  const fit = Math.floor(Math.min(byWidth, byHeight) * 100);
  return Math.max(min, Math.min(max, fit));
}
