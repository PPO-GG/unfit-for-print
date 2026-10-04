import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  confirm: vi.fn(async () => true),
  notify: vi.fn(),
  activityFetch: vi.fn(async () => ({})),
  kickPlayer: vi.fn(async () => {}),
  removePlayer: vi.fn(),
}));

vi.stubGlobal("useI18n", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
}));
vi.stubGlobal("useNotifications", () => ({ notify: h.notify }));
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: h.activityFetch }));
vi.mock("~/composables/useConfirm", () => ({
  useConfirm: () => ({ confirm: h.confirm }),
}));
vi.mock("~/composables/useLobby", () => ({
  useLobby: () => ({
    kickPlayer: h.kickPlayer,
    mutations: { removePlayer: h.removePlayer },
  }),
}));

import { useRemovePlayer } from "~/composables/useRemovePlayer";

describe("useRemovePlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.confirm.mockResolvedValue(true);
  });

  it("asks before removing, naming the player", async () => {
    await useRemovePlayer().removePlayer("l1", { userId: "u2", name: "Sam", playerType: "player" });
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.confirm.mock.calls[0]![0]).toMatchObject({
      title: 'lobby.remove_confirm_title|{"name":"Sam"}',
      confirmButtonColor: "error",
    });
  });

  it("does nothing when the host cancels", async () => {
    h.confirm.mockResolvedValue(false);
    const ok = await useRemovePlayer().removePlayer("l1", { userId: "u2", name: "Sam", playerType: "player" });
    expect(ok).toBe(false);
    expect(h.kickPlayer).not.toHaveBeenCalled();
    expect(h.activityFetch).not.toHaveBeenCalled();
  });

  // kickPlayer is the path that also deletes the server row and sends the
  // kicked client home; a doc-only removal let them straight back in.
  it("kicks a human through the lobby kick", async () => {
    const ok = await useRemovePlayer().removePlayer("l1", { userId: "u2", name: "Sam", playerType: "player" });
    expect(ok).toBe(true);
    expect(h.kickPlayer).toHaveBeenCalledWith("l1", "u2");
    expect(h.removePlayer).not.toHaveBeenCalled();
  });

  it("kicks a spectator the same way", async () => {
    await useRemovePlayer().removePlayer("l1", { userId: "u3", name: "Ed", playerType: "spectator" });
    expect(h.kickPlayer).toHaveBeenCalledWith("l1", "u3");
  });

  // A bot left in Postgres is still dealt a hand by game/start.
  it("removes a bot's server row and its doc entry", async () => {
    await useRemovePlayer().removePlayer("l1", { userId: "b1", name: "SnappySquid", playerType: "bot" });
    expect(h.activityFetch).toHaveBeenCalledWith("/api/bot/remove", {
      method: "POST",
      body: { lobbyId: "l1", botUserId: "b1" },
    });
    expect(h.removePlayer).toHaveBeenCalledWith("b1", "SnappySquid");
    expect(h.kickPlayer).not.toHaveBeenCalled();
  });

  it("tells the host when removal fails", async () => {
    h.kickPlayer.mockRejectedValueOnce(new Error("boom"));
    const ok = await useRemovePlayer().removePlayer("l1", { userId: "u2", name: "Sam", playerType: "player" });
    expect(ok).toBe(false);
    expect(h.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'lobby.error_failed_to_kick|{"name":"Sam"}', color: "error" }),
    );
  });
});
