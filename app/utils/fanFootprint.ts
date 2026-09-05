/**
 * The static footprint of the card fan — the region the hand occupies with no
 * card hovered.
 *
 * All of it is baseline geometry: `spread` and `curveIntensity` come from FAN,
 * `cardWidth` is a layout width (unaffected by GSAP's transforms), and
 * top/bottom are the hand zone's own box. Nothing here reads an animated
 * position, which is the point — hover hit-testing that measured the live
 * positions fed back into itself, because hovering lifts the card out from
 * under the cursor and pushes its neighbours aside.
 */
export interface FanFootprint {
  cardCount: number;
  spread: number;
  /** Layout width of one card, i.e. `offsetWidth`, not the scaled-up width. */
  cardWidth: number;
  curveIntensity: number;
  /** Hand-zone bounding box, in client coordinates. */
  top: number;
  bottom: number;
}

/**
 * @param cursorX Pointer X *relative to the fan's centre*.
 * @param clientY Pointer Y in client coordinates.
 */
export function isWithinFanFootprint(
  cursorX: number,
  clientY: number,
  fan: FanFootprint,
): boolean {
  const outermost = Math.max(0, (fan.cardCount - 1) / 2);

  // Centre of the outermost card, plus its own half-width.
  const halfExtent = outermost * fan.spread + fan.cardWidth / 2;

  // getBaseTransform() translates each card *down* by offset² * curveIntensity,
  // so the outer cards of the arc hang below the hand zone's box.
  const curveDrop = outermost * outermost * fan.curveIntensity;

  return (
    Math.abs(cursorX) <= halfExtent &&
    clientY >= fan.top &&
    clientY <= fan.bottom + curveDrop
  );
}
