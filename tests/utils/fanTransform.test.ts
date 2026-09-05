import { applyHoverTransform } from "~/utils/fanTransform";

const FAN = { hoverPush: 65, hoverLift: 65 };

// Arc baselines for a 7-card hand: y = |offset|^2 * 4, so the end cards sit
// 36px lower than the middle one.
const centreBase = { x: 0, y: 0, rotation: 0 };
const endBase = { x: 210, y: 36, rotation: 15 };

describe("applyHoverTransform", () => {
  it("raises a hovered card to the same height wherever it sits in the arc", () => {
    const centre = applyHoverTransform({ index: 3, hovered: 3, base: centreBase, ...FAN });
    const end = applyHoverTransform({ index: 6, hovered: 6, base: endBase, ...FAN });

    expect(centre.y).toBe(-65);
    expect(end.y).toBe(-65);
  });

  it("keeps a hovered card's horizontal place in the fan", () => {
    const end = applyHoverTransform({ index: 6, hovered: 6, base: endBase, ...FAN });

    expect(end.x).toBe(210);
  });

  it("leaves an unhovered card at its arc height", () => {
    const neighbour = applyHoverTransform({ index: 6, hovered: 3, base: endBase, ...FAN });

    expect(neighbour.y).toBe(36);
  });

  it("pushes neighbours away from the hovered card", () => {
    const right = applyHoverTransform({ index: 4, hovered: 3, base: { x: 70, y: 4, rotation: 5 }, ...FAN });
    const left = applyHoverTransform({ index: 2, hovered: 3, base: { x: -70, y: 4, rotation: -5 }, ...FAN });

    expect(right.x).toBe(70 + 65);
    expect(left.x).toBe(-70 - 65);
  });

  it("tapers the push to nothing for distant cards", () => {
    const far = applyHoverTransform({ index: 6, hovered: 2, base: endBase, ...FAN });

    expect(far.x).toBe(210);
  });

  it("leaves every card on its baseline when nothing is hovered", () => {
    const card = applyHoverTransform({ index: 6, hovered: null, base: endBase, ...FAN });

    expect(card).toMatchObject({ x: 210, y: 36, rotation: 15, scale: 1 });
  });
});

// Asserted against the unselected result rather than literal numbers: the hover
// scale and lift are tuning knobs, and a duplicated literal elsewhere in the
// codebase is exactly what caused the click-to-select jump.
describe("applyHoverTransform — selection", () => {
  const hoveredPlain = applyHoverTransform({ index: 3, hovered: 3, base: centreBase, ...FAN });
  const restingPlain = applyHoverTransform({ index: 6, hovered: 3, base: endBase, ...FAN });

  it("never shrinks a card just because it got selected", () => {
    const card = applyHoverTransform({ index: 3, hovered: 3, base: centreBase, isSelected: true, ...FAN });

    expect(card.scale).toBe(hoveredPlain.scale);
  });

  it("stacks the selection lift on top of the hover height", () => {
    const card = applyHoverTransform({ index: 3, hovered: 3, base: centreBase, isSelected: true, ...FAN });

    expect(card.y).toBe(hoveredPlain.y - 25);
  });

  it("raises a selected card above its resting neighbours once hover moves on", () => {
    const card = applyHoverTransform({ index: 6, hovered: 3, base: endBase, isSelected: true, ...FAN });

    expect(card.scale).toBeGreaterThan(restingPlain.scale);
    expect(card.y).toBe(restingPlain.y - 25);
    expect(card.zIndex).toBeGreaterThan(restingPlain.zIndex);
  });

  it("keeps the hovered card stacked on top of a selected one", () => {
    const card = applyHoverTransform({ index: 3, hovered: 3, base: centreBase, isSelected: true, ...FAN });

    expect(card.zIndex).toBe(hoveredPlain.zIndex);
  });
});
