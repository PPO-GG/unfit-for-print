// 106 of the 111 real packs begin "Cards Against Humanity:", so a one-line
// truncated tile showed the same 23 characters on nearly every card and cut
// off the only part that identified it. These helpers split the shared series
// prefix away from the part that actually distinguishes a pack.
import { describe, it, expect } from "vitest";
import { commonPackPrefix, splitPackName } from "~/utils/packName";

describe("commonPackPrefix", () => {
  it("finds the shared prefix when most packs share one", () => {
    expect(
      commonPackPrefix([
        "Cards Against Humanity: Blue Box Expansion",
        "Cards Against Humanity: Hot Box",
        "Cards Against Humanity: Family Edition",
      ]),
    ).toBe("Cards Against Humanity:");
  });

  it("ignores the handful of packs that do not share it", () => {
    // The real data has 106 prefixed and 5 that are not; a strict
    // longest-common-prefix over every name would return "" and the feature
    // would silently do nothing.
    expect(
      commonPackPrefix([
        "Cards Against Humanity: Blue Box Expansion",
        "Cards Against Humanity: Hot Box",
        "Cards Against Humanity: Bōks",
        "CAH Base Set",
        "Unfit Labs",
      ]),
    ).toBe("Cards Against Humanity:");
  });

  it("returns nothing when the packs share no prefix", () => {
    expect(commonPackPrefix(["Alpha", "Beta", "Gamma"])).toBe("");
  });

  it("returns nothing for a single pack, which has no series to speak of", () => {
    expect(commonPackPrefix(["Cards Against Humanity: Hot Box"])).toBe("");
  });

  it("returns nothing for an empty list", () => {
    expect(commonPackPrefix([])).toBe("");
  });

  it("stops at a word boundary rather than mid-word", () => {
    // "Card Lab" and "Card Labs" share "Card Lab", but cutting there would
    // leave a headline of "s". Only whole words count.
    expect(commonPackPrefix(["Card Lab", "Card Labs", "Card Lantern"])).toBe(
      "Card",
    );
  });

  it("never derives a prefix that would blank out a pack's headline", () => {
    // The invariant that matters across the real set: whatever prefix comes
    // back, every pack still has something left to show as its title.
    const names = [
      "Cards Against Humanity: Blue Box Expansion",
      "Cards Against Humanity: Hot Box",
      "Cards Against Humanity: Bōks",
      "Cards Against Humanity",
      "CAH Base Set",
    ];
    const prefix = commonPackPrefix(names);
    for (const name of names) {
      expect(splitPackName(name, prefix).label).not.toBe("");
    }
  });
});

describe("splitPackName", () => {
  it("splits a prefixed name into series and the distinguishing part", () => {
    expect(
      splitPackName(
        "Cards Against Humanity: Blue Box Expansion",
        "Cards Against Humanity:",
      ),
    ).toEqual({ series: "Cards Against Humanity:", label: "Blue Box Expansion" });
  });

  it("leaves a non-matching name whole", () => {
    expect(splitPackName("Unfit Labs", "Cards Against Humanity:")).toEqual({
      series: "",
      label: "Unfit Labs",
    });
  });

  it("leaves every name whole when there is no prefix", () => {
    expect(splitPackName("Unfit Labs", "")).toEqual({
      series: "",
      label: "Unfit Labs",
    });
  });

  it("keeps the whole name when the remainder would be empty", () => {
    // A pack named exactly the prefix must not render a blank headline.
    expect(
      splitPackName("Cards Against Humanity:", "Cards Against Humanity:"),
    ).toEqual({ series: "", label: "Cards Against Humanity:" });
  });

  it("trims the separator left behind by the split", () => {
    expect(splitPackName("Series - Thing", "Series -")).toEqual({
      series: "Series -",
      label: "Thing",
    });
  });
});

describe("packAccent", () => {
  it("gives the same pack the same hue every time", async () => {
    const { packAccent } = await import("~/utils/packName");
    expect(packAccent("Cards Against Humanity: Hot Box")).toBe(
      packAccent("Cards Against Humanity: Hot Box"),
    );
  });

  it("gives different packs different hues", async () => {
    const { packAccent } = await import("~/utils/packName");
    expect(packAccent("Alpha")).not.toBe(packAccent("Beta"));
  });

  it("returns a usable css colour", async () => {
    const { packAccent } = await import("~/utils/packName");
    expect(packAccent("Alpha")).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
  });
});
