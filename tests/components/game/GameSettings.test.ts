// tests/components/game/GameSettings.test.ts
//
// The in-game settings panel binds a pack multi-select to `cardPacks`, which
// since 0012_pack_ids holds pack ids. A lobby created before that migration
// still holds raw pack keys, which may no longer be any pack's `name` (a
// display name was promoted over them). Once the roster loads, the panel must
// show names — never uuids — and a Save must write ids.
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");

const updateSettings = vi.fn();

vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
vi.stubGlobal("useLobby", () => ({ mutations: { updateSettings } }));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

import GameSettings from "~/components/game/GameSettings.vue";

const PRETTY = "11111111-1111-4111-8111-111111111111";
const BLUE = "22222222-2222-4222-8222-222222222222";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-/i;

beforeEach(() => {
  updateSettings.mockClear();
  vi.stubGlobal("$fetch", async (url: string) => {
    if (url !== "/api/cards/packs") return {};
    return {
      white: [
        { packId: PRETTY, pack: "Pretty", active: 40 },
        { packId: BLUE, pack: "Blue", active: 30 },
      ],
      black: [{ packId: PRETTY, pack: "Pretty", active: 5 }],
      meta: [
        { id: PRETTY, pack: "Pretty", legacyKey: "Raw Key" },
        { id: BLUE, pack: "Blue", legacyKey: null },
      ],
    };
  });
});

const USelectMenu = Vue.defineComponent({
  name: "USelectMenu",
  props: ["modelValue", "items", "valueKey", "multiple", "loading"],
  emits: ["update:modelValue"],
  template: "<div class='select-stub' />",
});

const UForm = Vue.defineComponent({
  name: "UForm",
  emits: ["submit"],
  template: "<form @submit.prevent=\"$emit('submit', $event)\"><slot /></form>",
});

function mountPanel(isEditable: boolean) {
  return mount(GameSettings, {
    props: {
      isEditable,
      inline: true,
      settings: {
        maxPoints: 8,
        cardsPerPlayer: 10,
        maxPick: 3,
        manualDraw: false,
        isPrivate: false,
        lobbyName: "Test",
        // A pre-migration raw key alongside an id.
        cardPacks: ["Raw Key", BLUE],
      } as any,
    },
    global: {
      stubs: {
        USelectMenu,
        UForm,
        UInput: true,
        UCheckbox: true,
        UButton: true,
        Icon: true,
        Transition: false,
      },
    },
  });
}

describe("GameSettings — card packs", () => {
  it("offers packs by id and upgrades a legacy key to its id in the select", async () => {
    const wrapper = mountPanel(true);
    await flushPromises();

    const select = wrapper.getComponent(USelectMenu);
    expect(select.props("valueKey")).toBe("value");
    expect(select.props("multiple")).not.toBe(false);
    expect(select.props("items")).toEqual([
      { label: "Blue", value: BLUE },
      { label: "Pretty", value: PRETTY },
    ]);
    expect(select.props("modelValue")).toEqual([PRETTY, BLUE]);

    const tags = wrapper.findAll(".pack-tag").map((t) => t.text());
    expect(tags).toEqual(["Pretty", "Blue"]);
  });

  it("saves the selection as ids, including a change made in the select", async () => {
    const wrapper = mountPanel(true);
    await flushPromises();

    await wrapper.get("form").trigger("submit");
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ cardPacks: [PRETTY, BLUE] }),
    );

    wrapper.getComponent(USelectMenu).vm.$emit("update:modelValue", [BLUE]);
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ cardPacks: [BLUE] }),
    );
  });

  it("shows pack names, not uuids or raw keys, in the read-only view", async () => {
    const wrapper = mountPanel(false);
    await flushPromises();

    const packsRow = wrapper
      .findAll(".readonly-row")
      .find((row) => row.find(".readonly-key").text() === "game.settings.card_packs");
    const value = packsRow!.get(".readonly-val").text();
    expect(value).toBe("Pretty, Blue");
    expect(value).not.toMatch(UUID_RE);
  });
});
