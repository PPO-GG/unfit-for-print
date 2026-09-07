// tests/composables/useShufflePacks.test.ts
//
// The host's "Shuffle packs" control lives in two places — the settings drawer
// and the lobby-room summary — so the roster load, the roll and the Y.Doc
// write are shared here rather than duplicated in both components.
//
// pickRandomPacks itself is covered in tests/utils/cardPacks.test.ts; what
// these tests pin is the wiring: that a roll reaches updateSettings, that the
// current selection is fed back in as `exclude` so a second click actually
// changes something, and that a failed roster never blanks out the host's
// packs.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";

const stateStore = new Map<string, any>();
const updateSettings = vi.fn();
const notify = vi.fn();
const playSfx = vi.fn();

function stubNuxtGlobals() {
  vi.stubGlobal("useState", (key: string, init: () => any) => {
    if (!stateStore.has(key)) stateStore.set(key, ref(init()));
    return stateStore.get(key);
  });
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("useNuxtApp", () => {
    throw new Error("no nuxt app in unit tests");
  });
}
stubNuxtGlobals();

vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify }),
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("~/composables/useLobby", () => ({
  useLobby: () => ({ mutations: { updateSettings } }),
}));
vi.mock("~/composables/useSfx", () => ({ useSfx: () => ({ playSfx }) }));

import { useShufflePacks } from "~/composables/useShufflePacks";
import { useCardPacks } from "~/composables/useCardPacks";

/** 12 packs of 250 active cards each, so a 1000–2000 budget has room to move. */
function stubRoster(count = 12) {
  const white = Array.from({ length: count }, (_, i) => ({
    pack: `Pack ${i + 1}`,
    total: 200,
    active: 200,
  }));
  const black = Array.from({ length: count }, (_, i) => ({
    pack: `Pack ${i + 1}`,
    total: 50,
    active: 50,
  }));
  vi.stubGlobal("$fetch", async (url: string) => {
    if (url === "/api/cards/packs") return { white, black };
    if (url === "/api/cards/default-packs") return { packs: [] };
    throw new Error(`unexpected url ${url}`);
  });
}

/** Roster endpoint that always rejects. */
function stubFailingRoster() {
  vi.stubGlobal("$fetch", async () => {
    throw new Error("offline");
  });
}

beforeEach(() => {
  stateStore.clear();
  useCardPacks().reset();
  vi.unstubAllGlobals();
  stubNuxtGlobals();
  updateSettings.mockReset();
  notify.mockReset();
  playSfx.mockReset();
});

describe("useShufflePacks", () => {
  it("writes the rolled packs into the lobby settings", async () => {
    stubRoster();
    const { shuffle } = useShufflePacks();

    await shuffle([]);

    expect(updateSettings).toHaveBeenCalledTimes(1);
    const written = updateSettings.mock.calls[0]![0].cardPacks as string[];
    expect(written.length).toBeGreaterThan(0);
  });

  it("reports how many packs and cards the roll landed on", async () => {
    stubRoster();
    const { shuffle } = useShufflePacks();

    const result = await shuffle([]);

    expect(result).not.toBeNull();
    expect(result!.packs.length).toBe(4); // 4 × 250 cards clears the 1000 floor
    expect(result!.total).toBe(1000);
  });

  it("rolls a different set when the host shuffles twice", async () => {
    stubRoster();
    const { shuffle } = useShufflePacks();

    const first = await shuffle([]);
    const second = await shuffle(first!.packs);

    expect(new Set(second!.packs)).not.toEqual(new Set(first!.packs));
  });

  it("leaves the current packs alone when the roster cannot be loaded", async () => {
    stubFailingRoster();
    const { shuffle } = useShufflePacks();

    const result = await shuffle(["Pack 1"]);

    expect(result).toBeNull();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });

  it("plays the card-shuffle sound when a roll lands", async () => {
    stubRoster();
    const { shuffle } = useShufflePacks();

    await shuffle([]);

    expect(playSfx).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the roll could not be applied", async () => {
    // A shuffle sound followed by an error toast would read as "it worked".
    stubFailingRoster();
    const { shuffle } = useShufflePacks();

    await shuffle(["Pack 1"]);

    expect(playSfx).not.toHaveBeenCalled();
  });

  it("clears its pending flag once the roll settles", async () => {
    stubRoster();
    const { shuffle, pending } = useShufflePacks();

    const inFlight = shuffle([]);
    expect(pending.value).toBe(true);
    await inFlight;

    expect(pending.value).toBe(false);
  });
});
