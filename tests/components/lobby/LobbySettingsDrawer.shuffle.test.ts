// tests/components/lobby/LobbySettingsDrawer.shuffle.test.ts
//
// The drawer's "Shuffle" control sits on the Card Packs field label. Its one
// piece of logic is which pack list it hands to useShufflePacks: it must pass
// `activePacks` — the host's selection already filtered down to packs the
// roster still knows about — and not the raw setting. Feeding the raw list in
// would let a stale pack name defeat the re-roll guard, so the host could
// click Shuffle and watch the same chips light up again.
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");

const shuffle = vi.fn().mockResolvedValue({ packs: ["Rolled"], total: 1200 });
const updateSettings = vi.fn();

// The drawer reaches useNotifications through Nuxt's auto-import, so it has to
// be stubbed as a global rather than mocked as a module.
vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
vi.stubGlobal("useNotifications", () => ({ notify: vi.fn() }));
vi.mock("~/composables/useLobby", () => ({
  useLobby: () => ({ mutations: { updateSettings } }),
}));
vi.mock("~/composables/useShufflePacks", () => ({
  useShufflePacks: () => ({ shuffle, pending: Vue.ref(false) }),
}));

import LobbySettingsDrawer from "~/components/lobby/LobbySettingsDrawer.vue";

/** Roster the drawer fetches on open: two real packs, so "Ghost" is stale. */
function stubPackRoster() {
  vi.stubGlobal("$fetch", async (url: string) => {
    if (url === "/api/cards/packs") {
      return {
        white: [
          { pack: "Base", active: 400 },
          { pack: "Blue", active: 300 },
        ],
        black: [
          { pack: "Base", active: 100 },
          { pack: "Blue", active: 80 },
        ],
      };
    }
    if (url === "/api/cards/default-packs") return { packs: ["Base"] };
    return {};
  });
}

const settings = {
  maxPoints: 8,
  cardsPerPlayer: 10,
  maxPick: 3,
  manualDraw: false,
  hasPassword: false,
  lobbyName: "Test",
  isPrivate: false,
  cardPacks: ["Base", "Ghost"],
} as any;

function mountDrawer(isHost = true) {
  return mount(LobbySettingsDrawer, {
    props: { open: true, settings, isHost, lobbyId: "lobby-1" },
    global: {
      stubs: { UIcon: true, Teleport: true, Transition: false },
    },
  });
}

beforeEach(() => {
  shuffle.mockClear();
  updateSettings.mockClear();
  stubPackRoster();
});

describe("LobbySettingsDrawer — shuffle control", () => {
  it("hands the roster-validated pack list to the shuffle", async () => {
    const wrapper = mountDrawer();
    await flushPromises();

    await wrapper.get(".lsd-shuffle-btn").trigger("click");

    expect(shuffle).toHaveBeenCalledWith(["Base"]);
  });

  it("hides the control from non-hosts", async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    expect(wrapper.find(".lsd-shuffle-btn").exists()).toBe(false);
  });
});
