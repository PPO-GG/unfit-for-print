import type { ComputedRef, Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";
import { Query } from "appwrite";
import { getAppwrite } from "~/utils/appwrite";
import { useNotifications } from "~/composables/useNotifications";
import { useI18n } from "vue-i18n";

/**
 * Handles converting a spectator into an active player mid-game.
 * Updates the player document type and deals a fresh hand of white cards.
 */
export function useSpectatorConversion(options: {
  isHost: ComputedRef<boolean>;
  players: Ref<Player[]>;
  lobbyRef: Ref<Lobby | null>;
  state: ComputedRef<GameState | null>;
  getPlayerName: (playerId: string | null) => string;
}) {
  const { isHost, players, lobbyRef, state, getPlayerName } = options;
  const { notify } = useNotifications();
  const { t } = useI18n();

  const { databases } = getAppwrite();

  const convertToPlayer = async (playerId: string) => {
    if (!isHost.value) return;

    try {
      const playerDoc = players.value.find((p) => p.userId === playerId);
      if (!playerDoc || !databases) return;

      const config = useRuntimeConfig();

      // 1. Update player type in database
      await databases.updateDocument(
        config.public.appwriteDatabaseId as string,
        config.public.appwritePlayerCollectionId as string,
        playerDoc.$id,
        { playerType: "player" },
      );

      // 2. Deal cards to the player
      if (!lobbyRef.value || !lobbyRef.value.$id) {
        console.error("Cannot convert player: Lobby ID is undefined");
        notify({
          title: t("game.error_player_dealt_in"),
          description: t("game.lobby_id_missing"),
          color: "error",
          icon: "i-mdi-alert",
        });
        return;
      }

      const gameCardsRes = await databases.listDocuments(
        config.public.appwriteDatabaseId as string,
        config.public.appwriteGamecardsCollectionId,
        [Query.equal("lobbyId", lobbyRef.value.$id)],
      );

      if (gameCardsRes.total === 0) return;

      const gameCards = gameCardsRes.documents[0];
      const whiteDeck = gameCards.whiteDeck || [];
      const cardsPerPlayer = state.value?.config?.cardsPerPlayer || 7;

      const newHand = whiteDeck.slice(0, cardsPerPlayer);
      const remainingDeck = whiteDeck.slice(cardsPerPlayer);

      // Update player hands in the game cards document
      const existingHands = gameCards.playerHands || [];
      const parsedHands = existingHands.map((hand: string) => JSON.parse(hand));

      const existingHandIndex = parsedHands.findIndex(
        (h: { playerId: string }) => h.playerId === playerId,
      );
      if (existingHandIndex >= 0) {
        parsedHands[existingHandIndex].cards = newHand;
      } else {
        parsedHands.push({ playerId, cards: newHand });
      }

      await databases.updateDocument(
        config.public.appwriteDatabaseId as string,
        config.public.appwriteGamecardsCollectionId as string,
        gameCards.$id,
        {
          whiteDeck: remainingDeck,
          playerHands: parsedHands.map(
            (hand: { playerId: string; cards: string[] }) =>
              JSON.stringify(hand),
          ),
        },
      );

      notify({
        title: t("game.player_dealt_in"),
        description: t("game.player_dealt_in_description", {
          name: getPlayerName(playerId),
        }),
        color: "success",
        icon: "i-mdi-account-plus",
      });
    } catch (err) {
      console.error("Failed to convert player to participant:", err);
      notify({
        title: t("game.error_player_dealt_in"),
        color: "error",
        icon: "i-mdi-alert",
      });
    }
  };

  return { convertToPlayer };
}
