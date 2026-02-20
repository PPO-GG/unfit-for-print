import type { ComputedRef, Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";
import { useNotifications } from "~/composables/useNotifications";
import { useI18n } from "vue-i18n";

/**
 * Handles converting a spectator into an active player mid-game.
 * Now delegates entirely to a server-side endpoint for proper validation.
 */
export function useSpectatorConversion(options: {
  isHost: ComputedRef<boolean>;
  players: Ref<Player[]>;
  lobbyRef: Ref<Lobby | null>;
  state: ComputedRef<GameState | null>;
  getPlayerName: (playerId: string | null) => string;
}) {
  const { isHost, lobbyRef, getPlayerName } = options;
  const { notify } = useNotifications();
  const { t } = useI18n();

  const convertToPlayer = async (playerId: string) => {
    if (!isHost.value) return;
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

    try {
      await $fetch("/api/game/convert-spectator", {
        method: "POST",
        body: { lobbyId: lobbyRef.value.$id, playerId },
      });

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
