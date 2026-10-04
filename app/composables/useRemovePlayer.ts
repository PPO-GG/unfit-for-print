import { useConfirm } from "~/composables/useConfirm";
import { useLobby } from "~/composables/useLobby";

interface RemovablePlayer {
  userId: string;
  name?: string;
  playerType?: string;
}

/**
 * The host's "remove this player", shared by the lobby and the in-game menu.
 *
 * Asks first, then takes the path that matches who is leaving: a person goes
 * through `kickPlayer`, which also deletes their server row and leaves the
 * marker that sends their client home — a doc-only removal let them straight
 * back in on refresh. A bot's row goes through `/api/bot/remove`, or
 * `game/start` (which reads Postgres) would still deal it a hand.
 */
export function useRemovePlayer() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { notify } = useNotifications();
  const { $activityFetch } = useNuxtApp();
  const { kickPlayer, mutations } = useLobby();

  async function removePlayer(lobbyId: string, player: RemovablePlayer): Promise<boolean> {
    const name = player.name || t("lobby.unknown_player");
    const ok = await confirm({
      title: t("lobby.remove_confirm_title", { name }),
      message: t("lobby.remove_confirm_body"),
      confirmButtonText: t("lobby.remove_player"),
      confirmButtonColor: "error",
      cancelButtonText: t("lobby.remove_cancel"),
    });
    if (!ok) return false;

    try {
      if (player.playerType === "bot") {
        await $activityFetch("/api/bot/remove", {
          method: "POST",
          body: { lobbyId, botUserId: player.userId },
        });
        mutations.removePlayer(player.userId, player.name);
      } else {
        await kickPlayer(lobbyId, player.userId);
      }
      return true;
    } catch (err) {
      console.error("Failed to remove player:", err);
      notify({ title: t("lobby.error_failed_to_kick", { name }), color: "error" });
      return false;
    }
  }

  return { removePlayer };
}
