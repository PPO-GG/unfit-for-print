import type { ComputedRef, Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";
import { useNotifications } from "~/composables/useNotifications";
import { useI18n } from "vue-i18n";

/**
 * Handles converting a spectator into an active player mid-game.
 * Delegates to the Y.Doc game engine which deals cards and updates state locally,
 * syncing to all clients via Teleportal.
 */
export function useSpectatorConversion(options: {
  isHost: ComputedRef<boolean>;
  players: Ref<Player[]>;
  lobbyRef: Ref<Lobby | null>;
  state: ComputedRef<GameState | null>;
  getPlayerName: (playerId: string | null) => string;
}) {
  const { isHost, getPlayerName } = options;
  const { notify } = useNotifications();
  const { t } = useI18n();

  // Y.Doc game engine — replaces the server API call
  const lobbyDoc = useLobbyDoc();
  const engine = useYjsGameEngine(lobbyDoc);

  const convertToPlayer = async (playerId: string) => {
    if (!isHost.value) return;

    const result = engine.convertToPlayer(playerId);

    if (result.success) {
      notify({
        title: t("game.player_dealt_in"),
        description: t("game.player_dealt_in_description", {
          name: getPlayerName(playerId),
        }),
        color: "success",
        icon: "i-mdi-account-plus",
      });
    } else {
      console.error("Failed to convert player to participant:", result.reason);
      notify({
        title: t("game.error_player_dealt_in"),
        description: result.reason,
        color: "error",
        icon: "i-mdi-alert",
      });
    }
  };

  return { convertToPlayer };
}
