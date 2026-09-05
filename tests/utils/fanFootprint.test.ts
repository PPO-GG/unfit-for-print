import { isWithinFanFootprint } from "~/utils/fanFootprint";

// A 7-card desktop fan: half-extent = 3 * 70 + 70 = 280px either side of centre,
// and the outer cards' arc curve drops them 3^2 * 4 = 36px below the zone box.
const FAN = {
  cardCount: 7,
  spread: 70,
  cardWidth: 140,
  curveIntensity: 4,
  top: 100,
  bottom: 300,
};

describe("isWithinFanFootprint", () => {
  it("holds inside the band a lifted card vacates", () => {
    expect(isWithinFanFootprint(0, 295, FAN)).toBe(true);
  });

  it("holds midway between two baseline card centres", () => {
    expect(isWithinFanFootprint(35, 200, FAN)).toBe(true);
  });

  it("holds below the zone box, within the outer cards' curve drop", () => {
    expect(isWithinFanFootprint(0, 330, FAN)).toBe(true);
  });

  it("rejects empty space past the fan's outer edge", () => {
    expect(isWithinFanFootprint(300, 200, FAN)).toBe(false);
    expect(isWithinFanFootprint(-300, 200, FAN)).toBe(false);
  });

  it("rejects space above the zone box", () => {
    expect(isWithinFanFootprint(0, 99, FAN)).toBe(false);
  });

  it("rejects space below the curve drop", () => {
    expect(isWithinFanFootprint(0, 340, FAN)).toBe(false);
  });

  it("measures a single card by its own width, with no curve drop", () => {
    const single = { ...FAN, cardCount: 1 };

    expect(isWithinFanFootprint(69, 200, single)).toBe(true);
    expect(isWithinFanFootprint(71, 200, single)).toBe(false);
    expect(isWithinFanFootprint(0, 301, single)).toBe(false);
  });
});
