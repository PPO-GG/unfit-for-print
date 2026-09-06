// tests/composables/useCardPacks.test.ts
//
// The pack roster is read by two places on the Labs page at once — the hero's
// "cards in the deck" stat and the card browser's gallery — so the composable
// has to share one fetch between callers rather than hitting the API twice.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";

// Nuxt auto-imports these into composables; the suite runs plain vitest.
const stateStore = new Map<string, any>();
vi.stubGlobal("useState", (key: string, init: () => any) => {
  if (!stateStore.has(key)) stateStore.set(key, ref(init()));
  return stateStore.get(key);
});
vi.stubGlobal("computed", computed);
vi.stubGlobal("useNuxtApp", () => {
  throw new Error("no nuxt app in unit tests");
});

import { useCardPacks } from "~/composables/useCardPacks";

/** Answers both pack endpoints and counts how many times each was called. */
function stubPackEndpoints(
  packs: { white: any[]; black: any[] },
  defaults: string[] = [],
) {
  const calls: string[] = [];
  vi.stubGlobal("$fetch", async (url: string) => {
    calls.push(url);
    if (url === "/api/cards/packs") return packs;
    if (url === "/api/cards/default-packs") return { packs: defaults };
    throw new Error(`unexpected url ${url}`);
  });
  return calls;
}

beforeEach(() => {
  stateStore.clear();
  useCardPacks().reset();
  vi.unstubAllGlobals();
  vi.stubGlobal("useState", (key: string, init: () => any) => {
    if (!stateStore.has(key)) stateStore.set(key, ref(init()));
    return stateStore.get(key);
  });
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useNuxtApp", () => {
    throw new Error("no nuxt app in unit tests");
  });
});

describe("useCardPacks", () => {
  it("exposes the pack gallery and a total active card count after loading", async () => {
    stubPackEndpoints(
      {
        white: [{ pack: "Base", total: 12, active: 10 }],
        black: [{ pack: "Base", total: 5, active: 4 }],
      },
      ["Base"],
    );

    const { tiles, totalCards, load } = useCardPacks();
    await load();

    expect(tiles.value).toEqual([
      { pack: "Base", white: 10, black: 4, total: 14, isDefault: true },
    ]);
    expect(totalCards.value).toBe(14);
  });

  it("fetches once even when two callers load concurrently", async () => {
    const calls = stubPackEndpoints({
      white: [{ pack: "Base", total: 1, active: 1 }],
      black: [],
    });

    const hero = useCardPacks();
    const browser = useCardPacks();
    await Promise.all([hero.load(), browser.load()]);

    expect(calls.filter((url) => url === "/api/cards/packs")).toHaveLength(1);
  });

  it("does not refetch once the roster is already loaded", async () => {
    const calls = stubPackEndpoints({
      white: [{ pack: "Base", total: 1, active: 1 }],
      black: [],
    });

    const { load } = useCardPacks();
    await load();
    await load();

    expect(calls.filter((url) => url === "/api/cards/packs")).toHaveLength(1);
  });

  it("refetches when a reload is explicitly forced", async () => {
    const calls = stubPackEndpoints({
      white: [{ pack: "Base", total: 1, active: 1 }],
      black: [],
    });

    const { load } = useCardPacks();
    await load();
    await load({ force: true });

    expect(calls.filter((url) => url === "/api/cards/packs")).toHaveLength(2);
  });

  it("clears loading and leaves an empty roster when the API fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("$fetch", async () => {
      throw new Error("boom");
    });

    const { tiles, loading, load } = useCardPacks();
    await load();

    expect(loading.value).toBe(false);
    expect(tiles.value).toEqual([]);
  });

  it("allows a retry after a failed load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("$fetch", async () => {
      throw new Error("boom");
    });
    const { load, tiles } = useCardPacks();
    await load();

    stubPackEndpoints({
      white: [{ pack: "Base", total: 1, active: 1 }],
      black: [],
    });
    await load();

    expect(tiles.value.map((t) => t.pack)).toEqual(["Base"]);
  });
});
