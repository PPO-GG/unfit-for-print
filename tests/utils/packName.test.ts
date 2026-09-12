// 106 of the 111 real packs begin "Cards Against Humanity:", so a one-line
// truncated tile showed the same 23 characters on nearly every card and cut
// off the only part that identified it. These helpers split the shared series
// prefix away from the part that actually distinguishes a pack.
import { describe, it, expect } from "vitest";
import { commonPackPrefix, packLabel, splitPackName } from "~/utils/packName";

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

// `packLabel` is the single rule every surface that renders a pack name now
// shares — the admin tile and rail, the Labs gallery, and the card-face
// footer. Before it, four call sites each had their own idea of what a pack
// was called, so the same pack read three different ways on three screens.
describe("packLabel", () => {
  it("prefers explicit metadata over the derived split", () => {
    expect(
      packLabel(
        "Cards Against Humanity: Blue Box Expansion",
        { displayName: "Blue Box", series: "Cards Against Humanity" },
        "Cards Against Humanity:",
      ),
    ).toEqual({
      series: "Cards Against Humanity",
      name: "Blue Box",
      full: "Cards Against Humanity: Blue Box",
    });
  });

  it("falls back to the derived split when there is no metadata row", () => {
    // Most packs have no card_packs row at all, so the prefix guess is the
    // only thing standing between the rail and 106 identical truncations.
    expect(
      packLabel(
        "Cards Against Humanity: Hot Box",
        null,
        "Cards Against Humanity:",
      ),
    ).toEqual({
      series: "Cards Against Humanity",
      name: "Hot Box",
      full: "Cards Against Humanity: Hot Box",
    });
  });

  it("keeps a derived series alongside a custom display name", () => {
    // The rule this reverses: AdminPackTile used to drop the derived series
    // as soon as a displayName existed, which is exactly why the tile and the
    // rail disagreed about the same pack. Series and name are orthogonal —
    // renaming a pack does not move it out of its brand.
    expect(
      packLabel(
        "Cards Against Humanity: Hot Box",
        { displayName: "Hot Box Redux", series: null },
        "Cards Against Humanity:",
      ),
    ).toEqual({
      series: "Cards Against Humanity",
      name: "Hot Box Redux",
      full: "Cards Against Humanity: Hot Box Redux",
    });
  });

  it("takes an explicit series for a pack whose key does not carry one", () => {
    // The real "CAH Base Set" case: the key shares no prefix with anything,
    // so only the metadata knows it belongs to the CAH brand.
    expect(
      packLabel(
        "CAH Base Set",
        { displayName: "Base Pack", series: "Cards Against Humanity" },
        "Cards Against Humanity:",
      ),
    ).toEqual({
      series: "Cards Against Humanity",
      name: "Base Pack",
      full: "Cards Against Humanity: Base Pack",
    });
  });

  it("renders the bare name when nothing supplies a series", () => {
    expect(packLabel("Unfit Labs", null, "Cards Against Humanity:")).toEqual({
      series: "",
      name: "Unfit Labs",
      full: "Unfit Labs",
    });
  });

  it("strips the separator the derived series carries", () => {
    // splitPackName returns "Cards Against Humanity:" with its colon, and
    // composing that naively would read "Cards Against Humanity:: Hot Box".
    expect(
      packLabel("Series - Thing", null, "Series -").full,
    ).toBe("Series: Thing");
  });

  it("does not repeat a series the name already carries", () => {
    // An admin who types the full name into Display Name should not get
    // "Cards Against Humanity: Cards Against Humanity: Hot Box".
    expect(
      packLabel(
        "Cards Against Humanity: Hot Box",
        { displayName: "Cards Against Humanity: Hot Box", series: "Cards Against Humanity" },
        "Cards Against Humanity:",
      ).full,
    ).toBe("Cards Against Humanity: Hot Box");
  });

  it("ignores metadata fields that are blank rather than null", () => {
    // pack-meta.post.ts stores "" for a cleared input on some paths; a blank
    // display name must not blank out the headline.
    expect(
      packLabel(
        "Cards Against Humanity: Hot Box",
        { displayName: "  ", series: "" },
        "Cards Against Humanity:",
      ),
    ).toEqual({
      series: "Cards Against Humanity",
      name: "Hot Box",
      full: "Cards Against Humanity: Hot Box",
    });
  });

  it("works with no prefix at all, as a single card's footer must", () => {
    // The card face knows only its own pack string — there is no roster to
    // derive a prefix from, so meta is the only source of a series there.
    expect(
      packLabel("CAH Base Set", { displayName: "Base Pack", series: "Cards Against Humanity" }),
    ).toEqual({
      series: "Cards Against Humanity",
      name: "Base Pack",
      full: "Cards Against Humanity: Base Pack",
    });
  });
});
