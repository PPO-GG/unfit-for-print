import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchLiveLobbies,
  planLobbyReconciliation,
  type LiveLobbySummary,
} from "~/server/utils/reconcileLobbies";

const row = (over: Record<string, any> = {}) => ({
  id: "lobby-uuid",
  code: "ABCD",
  status: "playing" as const,
  lobbyName: "Old name",
  isPrivate: false,
  ...over,
});

const live = (over: Partial<LiveLobbySummary> = {}): LiveLobbySummary => ({
  code: "ABCD",
  status: "playing",
  lobbyName: "Old name",
  isPrivate: false,
  ...over,
});

describe("planLobbyReconciliation", () => {
  it("plans no update when the row already matches the live doc", () => {
    expect(planLobbyReconciliation([row()], [live()])).toEqual([]);
  });

  it("corrects a status the host's tab never synced", () => {
    const plan = planLobbyReconciliation([row()], [live({ status: "complete" })]);

    expect(plan).toEqual([
      { id: "lobby-uuid", updates: { status: "complete" } },
    ]);
  });

  it("corrects a renamed lobby, which nothing mirrored at all", () => {
    const plan = planLobbyReconciliation(
      [row()],
      [live({ lobbyName: "New name" })],
    );

    expect(plan).toEqual([
      { id: "lobby-uuid", updates: { lobbyName: "New name" } },
    ]);
  });

  it("corrects the private flag", () => {
    const plan = planLobbyReconciliation([row()], [live({ isPrivate: true })]);

    expect(plan).toEqual([{ id: "lobby-uuid", updates: { isPrivate: true } }]);
  });

  it("matches lobby codes case-insensitively", () => {
    const plan = planLobbyReconciliation(
      [row({ code: "abcd" })],
      [live({ code: "ABCD", status: "complete" })],
    );

    expect(plan).toHaveLength(1);
  });

  it("leaves a lobby alone when no live doc reports on it", () => {
    // Absence is not evidence: Teleportal may be unreachable, or the doc may
    // have been GC'd. Pruning orphans is the sweeper's job, not this one's.
    expect(planLobbyReconciliation([row()], [])).toEqual([]);
  });

  it("ignores fields the summary does not carry", () => {
    // Teleportal is deployed separately, so an older build returns a summary
    // without these fields. Never overwrite real values with undefined.
    const plan = planLobbyReconciliation(
      [row()],
      [{ code: "ABCD" } as LiveLobbySummary],
    );

    expect(plan).toEqual([]);
  });

  it("ignores a status the lobby table does not accept", () => {
    const plan = planLobbyReconciliation(
      [row()],
      [live({ status: "bogus" })],
    );

    expect(plan).toEqual([]);
  });

  it("bundles several corrections for one lobby into a single update", () => {
    const plan = planLobbyReconciliation(
      [row()],
      [live({ status: "complete", lobbyName: "New name", isPrivate: true })],
    );

    expect(plan).toEqual([
      {
        id: "lobby-uuid",
        updates: {
          status: "complete",
          lobbyName: "New name",
          isPrivate: true,
        },
      },
    ]);
  });

  it("plans updates for each drifted lobby independently", () => {
    const plan = planLobbyReconciliation(
      [row(), row({ id: "other-uuid", code: "WXYZ" })],
      [live({ status: "complete" }), live({ code: "WXYZ" })],
    );

    expect(plan).toEqual([
      { id: "lobby-uuid", updates: { status: "complete" } },
    ]);
  });
});

describe("fetchLiveLobbies", () => {
  beforeEach(() => {
    globalThis.useRuntimeConfig = () =>
      ({ public: { lobbyTeleportalUrl: "ws://localhost:1235" } }) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the summary's lobbies", async () => {
    globalThis.$fetch = vi.fn().mockResolvedValue({
      lobbies: [{ code: "ABCD", status: "waiting" }],
      timestamp: 1,
    }) as any;
    await expect(fetchLiveLobbies()).resolves.toEqual([
      { code: "ABCD", status: "waiting" },
    ]);
    expect(globalThis.$fetch).toHaveBeenCalledWith(
      "http://localhost:1235/lobbies/summary",
      expect.objectContaining({ timeout: 2000 }),
    );
  });

  it("returns an empty list when Teleportal holds no docs", async () => {
    globalThis.$fetch = vi.fn().mockResolvedValue({ timestamp: 1 }) as any;
    await expect(fetchLiveLobbies()).resolves.toEqual([]);
  });

  it("returns null when Teleportal is unreachable", async () => {
    globalThis.$fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as any;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchLiveLobbies()).resolves.toBeNull();
  });
});
