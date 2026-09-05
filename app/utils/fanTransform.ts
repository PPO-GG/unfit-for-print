export interface HoverTransformInput {
  index: number;
  hovered: number | null;
  /** The card's resting place in the arc, from getBaseTransform(). */
  base: { x: number; y: number; rotation: number };
  hoverPush: number;
  hoverLift: number;
  isSelected?: boolean;
}

/** How far a selected card rides above wherever hover has already put it. */
const SELECTED_LIFT = 25;
/** A resting selected card stays slightly proud of its neighbours. */
const SELECTED_MIN_SCALE = 1.1;

export interface CardTransform {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
}

/**
 * Where a card sits once hover is taken into account.
 *
 * The hovered card rises to a *fixed* height rather than lifting relative to
 * its own arc position. The arc's baseline is quadratic, so a relative lift
 * dropped the end cards well below the middle one — 81px at a ten-card hand —
 * and hovering is the moment you're trying to read the card. Scale and rotation
 * were already normalised for the same reason; height was the straggler.
 */
export function applyHoverTransform(input: HoverTransformInput): CardTransform {
  return withSelection(hoverOnly(input), input.isSelected === true);
}

/**
 * Selection rides on top of the hover result and may only ever add — it lifts,
 * it raises the stack, and it holds a minimum scale. It must never shrink a
 * card, which is what a second hard-coded copy of the hover scale used to do on
 * click, snapping the card up and then easing it back down.
 */
function withSelection(t: CardTransform, isSelected: boolean): CardTransform {
  if (!isSelected) return t;
  return {
    ...t,
    y: t.y - SELECTED_LIFT,
    scale: Math.max(t.scale, SELECTED_MIN_SCALE),
    zIndex: Math.max(t.zIndex, 90),
  };
}

function hoverOnly(input: HoverTransformInput): CardTransform {
  const { index, hovered, base, hoverPush, hoverLift } = input;

  if (hovered === null) {
    return { x: base.x, y: base.y, rotation: base.rotation, scale: 1, zIndex: index };
  }

  if (index === hovered) {
    return {
      x: base.x,
      y: -hoverLift,
      rotation: base.rotation * 0.15, // Straighten up the card significantly
      scale: 1.1,
      zIndex: 100,
    };
  }

  const distance = Math.abs(index - hovered);
  const direction = index > hovered ? 1 : -1;
  // Stronger push for immediate neighbors, tapers off smoothly
  const pushFactor = Math.max(0, 1 - (distance - 1) * 0.35);

  return {
    x: base.x + direction * hoverPush * pushFactor,
    y: base.y,
    // Neighbours also get pushed slightly sideways in their angle to make room
    rotation: base.rotation + direction * 4 * pushFactor,
    scale: 1,
    zIndex: index,
  };
}
