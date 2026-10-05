// composables/useActivityPlay.ts
// The Discord Activity's Play button. Everyone in one Activity instance plays
// the same game: the server decides whether this press creates it (we become
// host and write the doc) or returns the existing one (we join it).

import { ref, onScopeDispose } from "vue";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import type { Lobby } from "~/types/lobby";

/** How often the menu re-checks whether this instance already has a game. */
const POLL_MS = 5000;

export function useActivityPlay() {
  const { $activityFetch } = useNuxtApp();
  const { isDiscordActivity, channelId, getSdk } = useDiscordSDK();
  const { getLobbyByInstanceId, initializeCreatedLobby, joinLobby } = useLobby();
  const userStore = useUserStore();

  /** Drives the Play / Join game label. */
  const hasLobby = ref(false);
  const busy = ref(false);
  const failed = ref(false);

  const instanceId = (): string | null => getSdk()?.instanceId ?? null;

  async function refresh() {
    const id = instanceId();
    if (!id) return;
    hasLobby.value = !!(await getLobbyByInstanceId(id));
  }

  async function play() {
    if (busy.value) return;
    busy.value = true;
    failed.value = false;
    try {
      const id = instanceId();
      if (!id) throw new Error("No Discord Activity instance id");
      const { lobby, created } = await $activityFetch<{ lobby: Lobby; created: boolean }>(
        "/api/lobby/activity-play",
        {
          method: "POST",
          body: { instanceId: id, channelId: channelId.value ?? undefined },
        },
      );
      if (created) {
        await initializeCreatedLobby(lobby);
      } else {
        await joinLobby(lobby.code, { username: userStore.user?.name ?? "Unknown" });
      }
      await navigateTo(`/game/${lobby.code}`);
    } catch (err) {
      console.error("[useActivityPlay] Play failed:", err);
      failed.value = true;
    } finally {
      busy.value = false;
    }
  }

  // Client only: the menu is server-rendered, and both passes must start from
  // hasLobby = false to hydrate cleanly.
  if (typeof window !== "undefined" && isDiscordActivity.value) {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    onScopeDispose(() => clearInterval(timer));
  }

  return { hasLobby, busy, failed, play, refresh };
}
