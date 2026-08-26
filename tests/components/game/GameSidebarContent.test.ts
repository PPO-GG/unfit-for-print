// tests/components/game/GameSidebarContent.test.ts
//
// Regression test for the final whole-branch review finding: GameSidebarContent
// was passing `lobby?.$id` as PlayerList's `lobby-id` prop, but Lobby was
// migrated from Appwrite's `$id` to Postgres's `id` (Task 14) — that prop was
// always the empty string, silently breaking bot removal and host-promotion
// sync to Postgres from the in-game sidebar. This asserts the prop now
// carries the real `lobby.id`.
//
// PlayerList.vue is intentionally NOT imported/mounted here: it eagerly
// imports useLobby -> useLobbyDoc, which touches `import.meta.hot` at module
// load time and blows up outside a real Vite dev/HMR context. We stub it by
// name (like GameBoard.test.ts's GLOBAL_STUBS) and assert on the rendered
// attribute instead of a component prop.
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";
import { ref, computed } from "vue";

// GameSidebarContent.vue relies on Nuxt's auto-import of Vue reactivity APIs
// inside <script setup> — no explicit `import { ref } from "vue"`. Plain
// vitest (no Nuxt auto-import plugin) needs these shimmed as globals.
Object.assign(globalThis, Vue);

(globalThis as any).useI18n = () => ({ t: (key: string) => key });

// GameSidebarContent.vue calls useBots() as a bare Nuxt auto-import (no
// explicit import statement), so — like useI18n above — it must be shimmed
// as a global rather than intercepted via vi.mock.
(globalThis as any).useBots = () => ({
  botPlayers: computed(() => []),
  canAddBot: computed(() => false),
  addingBot: ref(false),
  botError: ref(null),
  addBot: vi.fn(),
});

vi.unmock("vue");

import GameSidebarContent from "~/components/game/GameSidebarContent.vue";

const BASE_PROPS = {
  players: [],
  state: null,
  gameSettings: null,
  isHost: true,
  isStarting: false,
  isWaiting: true,
  joinedLobby: false,
  myId: "user-1",
  copied: false,
};

const GLOBAL_STUBS = {
  PlayerList: true,
  ChatBox: true,
  GameSettings: true,
  UModal: true,
  UButton: true,
  UFieldGroup: true,
  Icon: true,
  LanguageSwitcher: true,
  VoiceSwitcher: true,
  ThemeSwitcher: true,
};

describe("GameSidebarContent.vue — lobby-id prop wiring", () => {
  it("passes the real Postgres lobby.id (not $id) to PlayerList", () => {
    const wrapper = mount(GameSidebarContent, {
      props: {
        ...BASE_PROPS,
        lobby: { id: "lobby-postgres-id", code: "ABCD", hostUserId: "host-1" },
      },
      global: { stubs: GLOBAL_STUBS },
    });

    const playerListHtml = wrapper.find("player-list-stub").html();
    expect(playerListHtml).toContain('lobby-id="lobby-postgres-id"');
    expect(playerListHtml).not.toContain('lobby-id=""');
  });

  it("falls back to an empty string (not undefined) when lobby has no id", () => {
    const wrapper = mount(GameSidebarContent, {
      props: { ...BASE_PROPS, lobby: { code: "ABCD" } as any },
      global: { stubs: GLOBAL_STUBS },
    });

    const playerListHtml = wrapper.find("player-list-stub").html();
    expect(playerListHtml).toContain('lobby-id=""');
  });
});
