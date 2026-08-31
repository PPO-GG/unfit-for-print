import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";

const toastAdd = vi.fn();
const addPlayerMock = vi.fn();
const removePlayerMock = vi.fn();
const activityFetchMock = vi.fn();

Object.assign(globalThis, {
  useToast: () => ({ add: toastAdd }),
  useLobbyDoc: () => ({
    doc: ref({}),
    getPlayers: () => new Map([["bot-1", JSON.stringify({ name: "Bot 1" })]]),
  }),
  useLobbyMutations: () => ({ addPlayer: addPlayerMock, removePlayer: removePlayerMock }),
  useYjsGameEngine: () => ({}),
  useLobbyReactive: () => ({
    isHost: computed(() => false),
    isWaiting: computed(() => true),
    playerList: computed(() => []),
    gameState: computed(() => null),
  }),
  useNuxtApp: () => ({
    $activityFetch: activityFetchMock,
  }),
});

import { useBots } from "~/composables/useBots";

describe("useBots", () => {
  beforeEach(() => {
    toastAdd.mockReset();
    addPlayerMock.mockReset();
    removePlayerMock.mockReset();
    activityFetchMock.mockReset();
  });

  describe("addBot", () => {
    it("notifies the host when the five-bot limit is reached", async () => {
      const bots = Array.from({ length: 5 }, (_, index) => ({
        userId: `bot-${index}`,
        playerType: "bot",
      }));
      const { addBot } = useBots(
        ref({ id: "lobby-1", status: "waiting" } as any),
        ref(bots as any),
        computed(() => true),
      );

      await addBot();

      expect(toastAdd).toHaveBeenCalledWith({
        title: "Maximum of 5 bots reached",
        description: "Remove a bot before adding another.",
        color: "error",
      });
      expect(activityFetchMock).not.toHaveBeenCalled();
    });

    it("calls $activityFetch with lobbyId and writes the returned bot to Y.Doc", async () => {
      activityFetchMock.mockResolvedValueOnce({
        success: true,
        bot: {
          id: "player-bot-1",
          userId: "bot-user-1",
          name: "RoboCards",
          avatar: "https://avatar.test/robo.png",
          playerType: "bot",
        },
      });

      const { addBot } = useBots(
        ref({ id: "lobby-123", status: "waiting" } as any),
        ref([]),
        computed(() => true),
      );

      await addBot();

      expect(activityFetchMock).toHaveBeenCalledWith("/api/bot/add", {
        method: "POST",
        body: {
          lobbyId: "lobby-123",
          activeBotUserIds: [],
        },
      });

      expect(addPlayerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "bot-user-1",
          name: "RoboCards",
          avatar: "https://avatar.test/robo.png",
          playerType: "bot",
          provider: "bot",
        }),
      );
    });
  });

  describe("removeBot", () => {
    it("calls $activityFetch with lobbyId and botUserId and removes the bot from Y.Doc", async () => {
      activityFetchMock.mockResolvedValueOnce({ success: true });

      const { removeBot } = useBots(
        ref({ id: "lobby-123", status: "waiting" } as any),
        ref([{ userId: "bot-1", playerType: "bot" } as any]),
        computed(() => true),
      );

      await removeBot("bot-1");

      expect(activityFetchMock).toHaveBeenCalledWith("/api/bot/remove", {
        method: "POST",
        body: {
          lobbyId: "lobby-123",
          botUserId: "bot-1",
        },
      });

      expect(removePlayerMock).toHaveBeenCalledWith("bot-1", "Bot 1");
    });
  });
});

