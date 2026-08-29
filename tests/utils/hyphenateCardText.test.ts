import {
  emergencyHyphenateCardText,
  hyphenateCardText,
} from "~/utils/hyphenateCardText";

describe("hyphenateCardText", () => {
  it("leaves ordinary card copy unbroken", () => {
    expect(hyphenateCardText("A passive aggressive frog.")).toBe(
      "A passive aggressive frog.",
    );
  });

  it("offers at most one emergency break in a word", () => {
    const text = emergencyHyphenateCardText("antibacterial");

    expect((text.match(/\u00AD/g) || []).length).toBeLessThanOrEqual(1);
  });
});
