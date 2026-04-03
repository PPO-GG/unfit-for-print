// tests/components/game/mobile/MobileGameLayout.test.ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

// Mock canvas-confetti since it's not installed and not needed in tests
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.unmock("vue");

import MobileGameLayout from "~/components/game/mobile/MobileGameLayout.vue";
import type { Player } from "~/types/player";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLAYERS: Player[] = [
  {
    $id: "p1",
    userId: "u1",
    lobbyId: "lobby1",
    name: "Alice",
    avatar: "",
    isHost: true,
    joinedAt: "2024-01-01T00:00:00Z",
    provider: "discord",
    playerType: "player",
    afk: false,
  },
  {
    $id: "p2",
    userId: "u2",
    lobbyId: "lobby1",
    name: "Bob",
    avatar: "",
    isHost: false,
    joinedAt: "2024-01-01T00:00:01Z",
    provider: "discord",
    playerType: "player",
    afk: false,
  },
];

const CARD_TEXTS = {
  c1: { text: "A Roomba that judges your lifestyle", pack: "base" },
  c2: { text: "Another streaming service", pack: "base" },
  c3: { text: "Sentient AI", pack: "base" },
};

const BLACK_CARD = { id: "b1", text: "Why is the sky blue? _", pick: 1 };

const GLOBAL_STUBS = {
  MobileStatusBar: true,
  MobileBlackCard: true,
  MobileCardList: true,
  MobileActionBar: true,
  MobileSelectionSlots: true,
  Icon: true,
};

const defaultProps = {
  phase: "submitting",
  blackCard: BLACK_CARD,
  myHand: ["c1", "c2", "c3"],
  mySubmission: null,
  submissions: {},
  revealedCards: {},
  scores: { u1: 0, u2: 0 },
  myId: "u1",
  isJudge: false,
  isHost: true,
  isParticipant: true,
  isSpectator: false,
  players: PLAYERS,
  judgeId: "u2",
  cardTexts: CARD_TEXTS,
  effectiveRoundWinner: null,
  confirmedRoundWinner: null,
  winnerSelected: false,
  winningCards: [],
  round: 1,
  readingAloud: false,
  myAvatar: "",
};

function mountLayout(propsOverride: Record<string, any> = {}) {
  return mount(MobileGameLayout, {
    props: { ...defaultProps, ...propsOverride },
    global: { stubs: GLOBAL_STUBS },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MobileGameLayout", () => {
  // 1. Renders card list in select mode during submitting (non-judge, not submitted)
  it("renders MobileCardList in select mode during submitting when not judge and not submitted", () => {
    const wrapper = mountLayout({
      phase: "submitting",
      isJudge: false,
      mySubmission: null,
    });
    const cardList = wrapper.findComponent({ name: "MobileCardList" });
    expect(cardList.exists()).toBe(true);
    expect(cardList.attributes("mode")).toBe("select");
  });

  // 2. Shows post-submission state after player submits
  it('shows "Cards submitted!" text after player submits', () => {
    const wrapper = mountLayout({
      phase: "submitting",
      isJudge: false,
      mySubmission: ["c1"],
    });
    expect(wrapper.text()).toContain("Cards submitted");
  });

  // 3. Shows judge waiting state during submitting when user is judge
  it('shows "Waiting for players" when user is judge during submitting', () => {
    const wrapper = mountLayout({
      phase: "submitting",
      isJudge: true,
      mySubmission: null,
    });
    expect(wrapper.text()).toContain("Waiting for players");
  });

  // 4. Renders card list in judge mode during judging
  it("renders MobileCardList in judge mode during judging", () => {
    const wrapper = mountLayout({
      phase: "judging",
      isJudge: true,
    });
    const cardList = wrapper.findComponent({ name: "MobileCardList" });
    expect(cardList.exists()).toBe(true);
    expect(cardList.attributes("mode")).toBe("judge");
  });

  // 5. Always renders status bar and black card
  it("always renders MobileStatusBar and MobileBlackCard", () => {
    const wrapper = mountLayout();
    expect(wrapper.findComponent({ name: "MobileStatusBar" }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "MobileBlackCard" }).exists()).toBe(true);
  });

  // 6. Always renders action bar
  it("always renders MobileActionBar", () => {
    const wrapper = mountLayout();
    expect(wrapper.findComponent({ name: "MobileActionBar" }).exists()).toBe(true);
  });

  // 7. Shows winner celebration during roundEnd with winner selected
  it("shows winner celebration during roundEnd with winnerSelected", () => {
    const wrapper = mountLayout({
      phase: "roundEnd",
      winnerSelected: true,
      confirmedRoundWinner: "u1",
      effectiveRoundWinner: "u1",
      winningCards: ["c1"],
    });
    // Should show a winner celebration section — look for winner-related text or element
    const html = wrapper.html();
    // The winning cards should be rendered in the celebration area
    expect(html).toContain("winner") || expect(wrapper.find(".winner-celebration").exists()).toBe(true);
  });
});
