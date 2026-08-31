import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";
import { ref } from "vue";
import type { Player } from "~/types/player";

Object.assign(globalThis, Vue);

vi.mock("gsap", () => ({
  gsap: {
    fromTo: vi.fn(),
    to: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

vi.mock("~/utils/discord", () => ({
  getDiscordIdFromPlayer: vi.fn(() => null),
}));

(globalThis as any).useI18n = () => ({
  t: (key: string, params?: any) => {
    if (key === "game.round") return "Round";
    if (key === "game.first_to") return "First to";
    if (key === "game.phase_submission") return "Submission Phase";
    if (key === "game.phase_judging") return "Judging Phase";
    if (key === "game.round_end") return "Round End";
    if (key === "game.game_over") return "Game Over";
    if (key === "game.judge") return "JUDGE";
    if (key === "game.locked") return "LOCKED";
    if (key === "game.picking") return "PICKING";
    return key;
  },
});

(globalThis as any).useDiscordSDK = () => ({
  speakingDiscordIds: ref(new Set()),
  isDiscordActivity: ref(false),
});

vi.unmock("vue");

import GameHeader from "~/components/game/GameHeader.vue";

const mockPlayers: Player[] = [
  {
    $id: "p1",
    $createdAt: "",
    $updatedAt: "",
    $permissions: [],
    $databaseId: "",
    $collectionId: "",
    userId: "u1",
    name: "Maxwell",
    playerType: "player",
    avatar: "",
    provider: "anonymous",
  },
  {
    $id: "p2",
    $createdAt: "",
    $updatedAt: "",
    $permissions: [],
    $databaseId: "",
    $collectionId: "",
    userId: "u2",
    name: "Grover",
    playerType: "player",
    avatar: "",
    provider: "anonymous",
  },
  {
    $id: "p3",
    $createdAt: "",
    $updatedAt: "",
    $permissions: [],
    $databaseId: "",
    $collectionId: "",
    userId: "u3",
    name: "jfrog",
    playerType: "player",
    avatar: "",
    provider: "anonymous",
  },
  {
    $id: "p4",
    $createdAt: "",
    $updatedAt: "",
    $permissions: [],
    $databaseId: "",
    $collectionId: "",
    userId: "u4",
    name: "Leopard",
    playerType: "player",
    avatar: "",
    provider: "anonymous",
  },
  {
    $id: "p5",
    $createdAt: "",
    $updatedAt: "",
    $permissions: [],
    $databaseId: "",
    $collectionId: "",
    userId: "u5",
    name: "Mynd",
    playerType: "player",
    avatar: "",
    provider: "anonymous",
  },
];

describe("GameHeader.vue", () => {
  it("renders round, first to, phase and auto-sorted player list", () => {
    const wrapper = mount(GameHeader, {
      props: {
        state: {
          round: 4,
          phase: "submitting",
          submissions: { u1: ["c1"], u2: ["c2"], u4: ["c3"] },
          scores: { u1: 4, u2: 2, u3: 3, u4: 1, u5: 5 },
          judgeId: "u5",
          blackCard: null,
          whiteDeck: [],
          blackDeck: [],
          hands: {},
          discardWhite: [],
          discardBlack: [],
          roundEndStartTime: null,
          config: {
            maxPoints: 10,
            cardsPerPlayer: 10,
            cardPacks: [],
            isPrivate: false,
            lobbyName: "",
          },
        },
        isSubmitting: true,
        isJudging: false,
        judgeId: "u5",
        players: mockPlayers,
        submissions: { u1: ["c1"], u2: ["c2"], u4: ["c3"] },
        scores: { u1: 4, u2: 2, u3: 3, u4: 1, u5: 5 },
        maxPoints: 10,
        hostUserId: "u5",
        myId: "u5",
      },
      global: {
        stubs: {
          Icon: true,
          UIcon: true,
          UAvatar: true,
          AvatarDecoration: { template: "<div><slot /></div>" },
        },
      },
    });

    const html = wrapper.html();

    // Verify top round pill
    expect(html).toContain("04");
    expect(html).toContain("10");
    expect(html).toContain("Submission Phase");

    // Verify player names are present
    expect(html).toContain("Mynd");
    expect(html).toContain("Maxwell");
    expect(html).toContain("jfrog");
    expect(html).toContain("Grover");
    expect(html).toContain("Leopard");

    // Verify score sorting: u5 (score 5) should appear before u1 (score 4), then u3 (3), u2 (2), u4 (1)
    const text = wrapper.text();
    const posMynd = text.indexOf("Mynd");
    const posMaxwell = text.indexOf("Maxwell");
    const posJfrog = text.indexOf("jfrog");
    const posGrover = text.indexOf("Grover");
    const posLeopard = text.indexOf("Leopard");

    expect(posMynd).toBeLessThan(posMaxwell);
    expect(posMaxwell).toBeLessThan(posJfrog);
    expect(posJfrog).toBeLessThan(posGrover);
    expect(posGrover).toBeLessThan(posLeopard);

    // Verify statuses
    expect(html).toContain("JUDGE");
    expect(html).toContain("LOCKED");
    expect(html).toContain("PICKING");

    // Verify rank badges
    expect(html).toContain("1st");
    expect(html).toContain("2nd");
    expect(html).toContain("3rd");
  });

  it("defers re-sorting the player list until the score-fly badge has landed", async () => {
    const players: Player[] = [
      {
        $id: "p1",
        $createdAt: "",
        $updatedAt: "",
        $permissions: [],
        $databaseId: "",
        $collectionId: "",
        userId: "u1",
        name: "Alice",
        playerType: "player",
        avatar: "",
        provider: "anonymous",
      },
      {
        $id: "p2",
        $createdAt: "",
        $updatedAt: "",
        $permissions: [],
        $databaseId: "",
        $collectionId: "",
        userId: "u2",
        name: "Bob",
        playerType: "player",
        avatar: "",
        provider: "anonymous",
      },
    ];

    const baseState = {
      round: 1,
      phase: "judging",
      submissions: {},
      scores: { u1: 1, u2: 2 },
      judgeId: "u2",
      blackCard: null,
      whiteDeck: [],
      blackDeck: [],
      hands: {},
      discardWhite: [],
      discardBlack: [],
      roundEndStartTime: null,
      config: {
        maxPoints: 10,
        cardsPerPlayer: 10,
        cardPacks: [],
        isPrivate: false,
        lobbyName: "",
      },
    };

    vi.useFakeTimers();
    try {
      const wrapper = mount(GameHeader, {
        props: {
          state: baseState,
          isJudging: true,
          judgeId: "u2",
          players,
          submissions: {},
          scores: { u1: 1, u2: 2 },
          roundWinner: null,
          maxPoints: 10,
          hostUserId: "u1",
          myId: "u1",
        },
        global: {
          stubs: {
            Icon: true,
            UIcon: true,
            UAvatar: true,
            AvatarDecoration: { template: "<div><slot /></div>" },
          },
        },
      });

      // Bob (2 points) leads Alice (1 point) before anyone wins the round.
      let text = wrapper.text();
      expect(text.indexOf("Bob")).toBeLessThan(text.indexOf("Alice"));

      // Alice wins the round: scores and roundWinner update together, exactly
      // as the Y.Doc engine commits them (see server/utils game-engine.ts).
      await wrapper.setProps({
        scores: { u1: 3, u2: 2 },
        roundWinner: "u1",
      });
      await Vue.nextTick();

      // The +1 badge is still flying — the list must NOT have re-sorted yet,
      // otherwise the badge lands on Bob's old (now-vacated) slot.
      text = wrapper.text();
      expect(text.indexOf("Bob")).toBeLessThan(text.indexOf("Alice"));

      // Once the badge has had time to land, the real order applies.
      vi.advanceTimersByTime(950);
      await Vue.nextTick();

      text = wrapper.text();
      expect(text.indexOf("Alice")).toBeLessThan(text.indexOf("Bob"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits skip-player when host clicks skip", async () => {
    const wrapper = mount(GameHeader, {
      props: {
        state: {
          round: 1,
          phase: "submitting",
          submissions: {},
          scores: {},
          judgeId: "u5",
          blackCard: null,
          whiteDeck: [],
          blackDeck: [],
          hands: {},
          discardWhite: [],
          discardBlack: [],
          roundEndStartTime: null,
          config: {
            maxPoints: 10,
            cardsPerPlayer: 10,
            cardPacks: [],
            isPrivate: false,
            lobbyName: "",
          },
        },
        isSubmitting: true,
        judgeId: "u5",
        players: mockPlayers,
        submissions: {},
        scores: {},
        maxPoints: 10,
        hostUserId: "u5",
        myId: "u5",
      },
      global: {
        stubs: {
          Icon: true,
          UIcon: true,
          UAvatar: true,
          AvatarDecoration: { template: "<div><slot /></div>" },
        },
      },
    });

    // Find skip button on an unsubmitted player (e.g. u1)
    const skipBtn = wrapper.find("button[title='game.skip_player']");
    expect(skipBtn.exists()).toBe(true);

    await skipBtn.trigger("click");
    expect(wrapper.emitted("skip-player")).toBeTruthy();
  });
});
