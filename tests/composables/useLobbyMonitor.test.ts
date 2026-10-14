import { describe, expect, it, vi } from "vitest";
import { useLobbyMonitor } from "~/composables/useLobbyMonitor";
import { liveLobby } from "../helpers/unifiedLobby";

const statusBody = (codes: string[]) => ({
  server: { version: "2", activeClients: 1, activeDocuments: 1, idleDocTtlSec: 600 },
  lobbies: codes.map((c) => liveLobby(c)),
  issues: {},
  housekeeping: { dbOnlyStale: [], dbOnlyRecent: [], finished: [], emptyRooms: [], noRecord: [], leftoverCount: 0 },
});

function setup(fetchImpl: (url: string, opts?: any) => Promise<any>, confirmed = true) {
  const deps = {
    fetch: vi.fn(fetchImpl) as any,
    confirm: vi.fn(async () => confirmed),
    notify: vi.fn(),
    now: () => 1_000,
  };
  return { deps, monitor: useLobbyMonitor(deps) };
}

describe("useLobbyMonitor", () => {
  it("keeps the last good status when a refresh fails", async () => {
    let fail = false;
    const { monitor } = setup(async (url) => {
      if (url.includes("stats")) return { windowHours: 24 };
      if (fail) throw { data: { statusMessage: "worker down" } };
      return statusBody(["AB12"]);
    });
    await monitor.refresh();
    expect(monitor.status.value?.lobbies).toHaveLength(1);
    expect(monitor.lastUpdated.value).toBe(1_000);

    fail = true;
    await monitor.refresh();
    expect(monitor.status.value?.lobbies).toHaveLength(1);
    expect(monitor.error.value).toBe("worker down");
  });

  it("does nothing when a destructive action is cancelled", async () => {
    const { deps, monitor } = setup(async () => statusBody([]), false);
    await monitor.endGame(liveLobby("AB12"));
    expect(deps.fetch).not.toHaveBeenCalledWith("/api/admin/teleportal/gc", expect.anything());
  });

  it("ends a game by its doc id and refreshes", async () => {
    const { deps, monitor } = setup(async () => statusBody([]));
    await monitor.endGame(liveLobby("AB12"));
    expect(deps.fetch).toHaveBeenCalledWith("/api/admin/teleportal/gc", {
      method: "DELETE",
      body: { docId: "lobby/lobby-AB12" },
    });
    expect(deps.notify).toHaveBeenCalledWith(expect.objectContaining({ color: "success" }));
    expect(deps.fetch).toHaveBeenCalledWith("/api/admin/teleportal/status");
  });

  it("says which half failed when removing completely", async () => {
    const { deps, monitor } = setup(async (url) => {
      if (url === "/api/admin/lobby/delete") throw new Error("fk violation");
      return statusBody([]);
    });
    await monitor.removeCompletely(liveLobby("AB12"));
    expect(deps.notify).toHaveBeenCalledWith({
      title: "Game ended, but the record wasn't deleted",
      description: "fk violation",
      color: "error",
    });
  });

  it("prunes everything database-only with forceAllOrphans", async () => {
    const { deps, monitor } = setup(async (url) =>
      url.includes("prune") ? { prunedCount: 3, orphanedCount: 2, completedCount: 1 } : statusBody([]),
    );
    await monitor.pruneAllDbOnly();
    expect(deps.fetch).toHaveBeenCalledWith("/api/admin/lobby/prune", {
      method: "POST",
      body: { forceAllOrphans: true },
    });
    expect(deps.notify).toHaveBeenCalledWith({
      title: "Removed 3 lobbies",
      description: "2 database-only, 1 finished",
      color: "success",
    });
  });
});
