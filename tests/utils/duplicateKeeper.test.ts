import { describe, it, expect } from "vitest";
import { suggestKeeper } from "~/utils/duplicateKeeper";

const card = (extra: Record<string, unknown> = {}) => ({
  id: "id",
  text: "Being on fire",
  pack: "custom",
  active: true,
  ...extra,
});

describe("suggestKeeper", () => {
  it("prefers a card in a default pack", () => {
    const keeper = suggestKeeper(
      [card({ id: "a", pack: "custom" }), card({ id: "b", pack: "base" })],
      { defaultPacks: ["base"] },
    );
    expect(keeper.id).toBe("b");
  });

  it("prefers an active card over a disabled one", () => {
    const keeper = suggestKeeper(
      [card({ id: "a", active: false }), card({ id: "b", active: true })],
      { defaultPacks: [] },
    );
    expect(keeper.id).toBe("b");
  });

  it("prefers a card that has an image", () => {
    const keeper = suggestKeeper(
      [card({ id: "a" }), card({ id: "b", imageKey: "cards/b.png" })],
      { defaultPacks: [] },
    );
    expect(keeper.id).toBe("b");
  });

  it("prefers a card that has an attachment", () => {
    const keeper = suggestKeeper(
      [card({ id: "a" }), card({ id: "b", attachment: { kind: "audio" } })],
      { defaultPacks: [] },
    );
    expect(keeper.id).toBe("b");
  });

  it("prefers the longer text when nothing else separates them", () => {
    const keeper = suggestKeeper(
      [
        card({ id: "a", text: "being on fire" }),
        card({ id: "b", text: "Being on fire, again." }),
      ],
      { defaultPacks: [] },
    );
    expect(keeper.id).toBe("b");
  });

  it("ranks default-pack membership above having an image", () => {
    const keeper = suggestKeeper(
      [
        card({ id: "a", pack: "base" }),
        card({ id: "b", pack: "custom", imageKey: "cards/b.png" }),
      ],
      { defaultPacks: ["base"] },
    );
    expect(keeper.id).toBe("a");
  });

  it("ranks being active above being in a default pack", () => {
    // A disabled card is one an admin already ruled out; a pack alias
    // should not drag it back into the game.
    const keeper = suggestKeeper(
      [
        card({ id: "a", pack: "base", active: false }),
        card({ id: "b", pack: "custom", active: true }),
      ],
      { defaultPacks: ["base"] },
    );
    expect(keeper.id).toBe("b");
  });

  it("breaks exact ties deterministically by id", () => {
    const cards = [card({ id: "zzz" }), card({ id: "aaa" })];
    expect(suggestKeeper(cards, { defaultPacks: [] }).id).toBe("aaa");
    expect(suggestKeeper([...cards].reverse(), { defaultPacks: [] }).id).toBe(
      "aaa",
    );
  });

  it("does not mutate the array it is given", () => {
    const cards = [card({ id: "zzz" }), card({ id: "aaa" })];
    suggestKeeper(cards, { defaultPacks: [] });
    expect(cards.map((c) => c.id)).toEqual(["zzz", "aaa"]);
  });

  it("tolerates a null pack", () => {
    const keeper = suggestKeeper(
      [card({ id: "a", pack: null }), card({ id: "b", pack: "base" })],
      { defaultPacks: ["base"] },
    );
    expect(keeper.id).toBe("b");
  });

  it("tolerates null text", () => {
    const keeper = suggestKeeper(
      [card({ id: "a", text: null }), card({ id: "b", text: "Being on fire" })],
      { defaultPacks: [] },
    );
    expect(keeper.id).toBe("b");
  });
});
