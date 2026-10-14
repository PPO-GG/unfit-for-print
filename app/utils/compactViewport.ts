/**
 * The one rule that decides whether a screen gets the compact (phone) layout.
 *
 * Width alone is not enough: a landscape phone is ~844px wide but only ~390px
 * tall, and the desktop table cannot fit in that height. So a screen is
 * compact when it is narrow OR short.
 *
 * Keep COMPACT_MEDIA_QUERY in sync with the numbers below — scoped CSS cannot
 * import a JS constant, so stylesheets repeat the literal query.
 */
export const COMPACT_MAX_WIDTH = 768;
export const COMPACT_MAX_HEIGHT = 500;

export type Orientation = "portrait" | "landscape";

export const COMPACT_MEDIA_QUERY =
  "(max-width: 767.98px), (max-height: 499.98px)";

/**
 * The primary pointer is a finger: phones and tablets, but not a touchscreen
 * laptop driven by a mouse, which reports hover and a fine pointer.
 *
 * Only the game table reads this (via useCompactLayout's isCompactGame). Size
 * alone decides everything else, because the lobby and game over work fine on
 * touch and the table's hover-driven fan does not.
 */
export const TOUCH_PRIMARY_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

export function isCompactViewport(width: number, height: number): boolean {
  return width < COMPACT_MAX_WIDTH || height < COMPACT_MAX_HEIGHT;
}

export function viewportOrientation(width: number, height: number): Orientation {
  return width > height ? "landscape" : "portrait";
}
