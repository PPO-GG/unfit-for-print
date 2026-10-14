// State, auto-refresh and admin actions for the lobby monitor. Dependencies
// are passed in so the page wires Nuxt's fetch/confirm/notify and tests pass
// fakes.
import { ref } from "vue";
import type { UnifiedStatusResponse } from "~~/server/api/admin/teleportal/status.get";
import type { ActivityStats } from "~~/server/utils/activity";
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import { displayName } from "~/utils/lobbyMonitorView";

export const REFRESH_INTERVAL_MS = 10_000;

export interface LobbyMonitorDeps {
  fetch: <T>(url: string, opts?: Record<string, unknown>) => Promise<T>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmButtonText: string;
    confirmButtonColor: "error" | "warning";
  }) => Promise<boolean>;
  notify: (n: { title: string; description?: string; color: "success" | "error" }) => void;
  now?: () => number;
}

interface PruneResult {
  prunedCount: number;
  orphanedCount: number;
  completedCount: number;
}

function errorMessage(err: any, fallback: string): string {
  return err?.data?.statusMessage || err?.data?.message || err?.message || fallback;
}

export function useLobbyMonitor(deps: LobbyMonitorDeps) {
  const now = deps.now ?? Date.now;
  const status = ref<UnifiedStatusResponse | null>(null);
  const activity = ref<ActivityStats | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);
  const lastUpdated = ref<number | null>(null);
  const autoRefresh = ref(true);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    loading.value = true;
    // Independent of the status call: an outage in the counters must not
    // blank the live view.
    deps.fetch<ActivityStats>("/api/admin/stats/activity").then(
      (a) => (activity.value = a),
      (err) => console.warn("[LobbyMonitor] Activity stats fetch failed:", err),
    );
    try {
      status.value = await deps.fetch<UnifiedStatusResponse>("/api/admin/teleportal/status");
      error.value = null;
      lastUpdated.value = now();
    } catch (err) {
      // Keep the last good data on screen; the page shows a banner instead.
      error.value = errorMessage(err, "Failed to fetch lobby data");
    } finally {
      loading.value = false;
    }
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start(): void {
    stop();
    if (autoRefresh.value) timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
  }

  async function manualRefresh(): Promise<void> {
    await refresh();
    start();
  }

  function toggleAutoRefresh(): void {
    autoRefresh.value = !autoRefresh.value;
    if (autoRefresh.value) start();
    else stop();
  }

  function onVisibilityChange(hidden: boolean): void {
    if (hidden) return stop();
    if (autoRefresh.value) {
      void refresh();
      start();
    }
  }

  async function act(
    run: () => Promise<{ title: string; description?: string }>,
    failTitle: string,
    fallback: string,
  ): Promise<void> {
    try {
      deps.notify({ ...(await run()), color: "success" });
    } catch (err) {
      deps.notify({ title: failTitle, description: errorMessage(err, fallback), color: "error" });
    }
    await refresh();
  }

  const gc = (lobby: UnifiedLobby) =>
    deps.fetch("/api/admin/teleportal/gc", {
      method: "DELETE",
      body: { docId: lobby.teleportal!.docId },
    });
  const deleteRow = (lobby: UnifiedLobby) =>
    deps.fetch("/api/admin/lobby/delete", {
      method: "POST",
      body: { lobbyId: lobby.registry!.lobbyId },
    });

  async function markFinished(lobby: UnifiedLobby): Promise<void> {
    if (!lobby.registry) return;
    await act(
      async () => {
        await deps.fetch("/api/admin/lobby/update-status", {
          method: "POST",
          body: { lobbyId: lobby.registry!.lobbyId, status: "complete" },
        });
        return { title: "Marked finished", description: `${lobby.code} is hidden from the browser` };
      },
      "Couldn't mark finished",
      "Could not update status",
    );
  }

  async function endGame(lobby: UnifiedLobby): Promise<void> {
    if (!lobby.teleportal) return;
    const ok = await deps.confirm({
      title: "End game",
      message: `End "${displayName(lobby)}" and disconnect everyone?\n\nThe live game is wiped. The lobby record stays.`,
      confirmButtonText: "End game",
      confirmButtonColor: "error",
    });
    if (!ok) return;
    await act(
      async () => {
        await gc(lobby);
        return { title: "Game ended", description: `${lobby.code} disconnected` };
      },
      "Couldn't end the game",
      "Could not end the game",
    );
  }

  async function deleteRecord(lobby: UnifiedLobby): Promise<void> {
    if (!lobby.registry) return;
    const ok = await deps.confirm({
      title: "Delete lobby record",
      message: `Delete the database record for "${displayName(lobby)}"?\n\nRemoves the lobby and its players. Cannot be undone.`,
      confirmButtonText: "Delete",
      confirmButtonColor: "error",
    });
    if (!ok) return;
    await act(
      async () => {
        await deleteRow(lobby);
        return { title: "Record deleted", description: `${lobby.code} removed from the database` };
      },
      "Couldn't delete the record",
      "Could not delete lobby",
    );
  }

  async function removeCompletely(lobby: UnifiedLobby): Promise<void> {
    if (!lobby.teleportal || !lobby.registry) return;
    const ok = await deps.confirm({
      title: "Remove completely",
      message: `End "${displayName(lobby)}", disconnect everyone and delete its record?\n\nCannot be undone.`,
      confirmButtonText: "Remove",
      confirmButtonColor: "error",
    });
    if (!ok) return;
    let ended = false;
    try {
      await gc(lobby);
      ended = true;
      await deleteRow(lobby);
      deps.notify({ title: "Lobby removed", description: `${lobby.code} is gone`, color: "success" });
    } catch (err) {
      deps.notify({
        title: ended ? "Game ended, but the record wasn't deleted" : "Couldn't end the game",
        description: errorMessage(err, "Check the lobby manually"),
        color: "error",
      });
    }
    await refresh();
  }

  async function prune(forceAllOrphans: boolean): Promise<void> {
    const ok = await deps.confirm(
      forceAllOrphans
        ? {
            title: "Remove all database-only lobbies",
            message: "Delete every lobby record nobody has open, whatever its age, plus finished games older than 1h?\n\nLive games are not touched.",
            confirmButtonText: "Remove all",
            confirmButtonColor: "error",
          }
        : {
            title: "Clean up stale leftovers",
            message: "Delete database-only lobbies older than 2h and finished games older than 1h?",
            confirmButtonText: "Clean up",
            confirmButtonColor: "warning",
          },
    );
    if (!ok) return;
    await act(
      async () => {
        const r = await deps.fetch<PruneResult>("/api/admin/lobby/prune", {
          method: "POST",
          body: { forceAllOrphans },
        });
        return {
          title: `Removed ${r.prunedCount} ${r.prunedCount === 1 ? "lobby" : "lobbies"}`,
          description: `${r.orphanedCount} database-only, ${r.completedCount} finished`,
        };
      },
      "Clean-up failed",
      "Could not prune lobbies",
    );
  }

  async function endAllGames(): Promise<void> {
    const live = status.value?.lobbies.filter((l) => l.hasLiveDoc).length ?? 0;
    const ok = await deps.confirm({
      title: "End every live game",
      message: `End ${live === 1 ? "the 1 live game" : `all ${live} live games`} and disconnect every player?\n\nEmergencies only.`,
      confirmButtonText: "End every game",
      confirmButtonColor: "error",
    });
    if (!ok) return;
    await act(
      async () => {
        const r = await deps.fetch<{ flushed: number; remaining: number }>(
          "/api/admin/teleportal/gc-all",
          { method: "DELETE" },
        );
        return { title: `Ended ${r.flushed} games`, description: `${r.remaining} connections remain` };
      },
      "Couldn't end every game",
      "Could not flush lobbies",
    );
  }

  return {
    status, activity, error, loading, lastUpdated, autoRefresh,
    refresh, manualRefresh, start, stop, toggleAutoRefresh, onVisibilityChange,
    markFinished, endGame, deleteRecord, removeCompletely,
    pruneStale: () => prune(false),
    pruneAllDbOnly: () => prune(true),
    endAllGames,
  };
}
