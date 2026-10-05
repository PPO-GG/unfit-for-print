// composables/useActivityPlay.ts
// The Discord Activity's Play button. Everyone in one Activity instance plays
// the same game: the server decides whether this press creates it (we become
// host and write the doc) or returns the existing one (we join it).

import { ref, onScopeDispose } from "vue";
import { useUserStore } from "~/stores/userStore";
import type { Lobby } from "~/types/lobby";

/** How often the menu re-checks whether this instance already has a game. */
const POLL_MS = 5000;

/**
 * The slice of useLobby() this needs. The page passes its own useLobby()
 * rather than this building a second one alongside it.
 */
export interface ActivityPlayLobbyApi {
  getLobbyByInstanceId(instanceId: string): Promise<Lobby | null>;
  initializeCreatedLobby(lobby: Lobby): Promise<void>;
  joinLobby(code: string, options: { username: string }): Promise<unknown>;
}

/**
 * Why the last press failed. "locked": the host set a password, which nobody
 * in the Activity can enter, so retrying cannot help.
 */
export type ActivityPlayFailure = "locked" | "error";

export function useActivityPlay(lobbyApi: ActivityPlayLobbyApi) {
  const { $activityFetch } = useNuxtApp();
  const { isDiscordActivity, channelId, getSdk } = useDiscordSDK();
  const { getLobbyByInstanceId, initializeCreatedLobby, joinLobby } = lobbyApi;
  const userStore = useUserStore();

  /** Drives the Play / Join game label. */
  const hasLobby = ref(false);
  const busy = ref(false);
  const failure = ref<ActivityPlayFailure | null>(null);

  const instanceId = (): string | null => getSdk()?.instanceId ?? null;

  async function refresh() {
    const id = instanceId();
    if (!id) return;
    hasLobby.value = !!(await getLobbyByInstanceId(id));
  }

  async function play() {
    if (busy.value) return;
    busy.value = true;
    failure.value = null;
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
      } else if (lobby.hostUserId !== userStore.user?.id) {
        await joinLobby(lobby.code, { username: userStore.user?.name ?? "Unknown" });
      }
      // A returning host already has their seat: the game page puts them back
      // in the doc, or rebuilds it if their first attempt never wrote it.
      await navigateTo(`/game/${lobby.code}`);
    } catch (err: any) {
      console.error("[useActivityPlay] Play failed:", err);
      const status = err?.statusCode ?? err?.response?.status;
      failure.value = status === 403 ? "locked" : "error";
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

  return { hasLobby, busy, failure, play, refresh };
}
