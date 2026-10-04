import { describe, it, expect } from "vitest";
import { cardBaseWidthPx, fitCardScale } from "~/utils/cardFit";

describe("cardBaseWidthPx", () => {
  it("mirrors the cards' clamp(10rem, 12vw, 18rem)", () => {
    expect(cardBaseWidthPx(16, 375)).toBe(160); // 12vw = 45px → 10rem floor
    expect(cardBaseWidthPx(16, 1600)).toBe(192); // 12vw = 192px
    expect(cardBaseWidthPx(16, 4000)).toBe(288); // 18rem ceiling
  });
});

describe("fitCardScale", () => {
  const base = 160; // 10rem at 16px → card is 160×213.33 at scale 100

  it("is limited by height in a short portrait slot (iPhone SE prompt slot)", () => {
    // 343×200 slot: width allows 214%, height allows 93%
    expect(fitCardScale(343, 200, base)).toBe(93);
  });

  it("is limited by width in a narrow slot", () => {
    expect(fitCardScale(120, 400, base)).toBe(75);
  });

  it("clamps to min/max", () => {
    expect(fitCardScale(40, 40, base)).toBe(50);
    expect(fitCardScale(2000, 2000, base)).toBe(200);
    expect(fitCardScale(40, 40, base, { min: 30 })).toBe(30);
  });

  it("falls back to min for an unmeasured (0×0) slot", () => {
    expect(fitCardScale(0, 0, base)).toBe(50);
  });
});
