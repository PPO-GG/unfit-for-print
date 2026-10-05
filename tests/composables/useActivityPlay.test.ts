import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "~/stores/userStore";

const s = vi.hoisted(() => ({
  activityFetch: vi.fn(),
  getLobbyByInstanceId: vi.fn(),
  initializeCreatedLobby: vi.fn(),
  joinLobby: vi.fn(),
  navigateTo: vi.fn(),
  sdk: { instanceId: "i-1" } as { instanceId?: string } | null,
}));

vi.mock("~/composables/useLobby", () => ({
  useLobby: () => ({
    getLobbyByInstanceId: s.getLobbyByInstanceId,
    initializeCreatedLobby: s.initializeCreatedLobby,
    joinLobby: s.joinLobby,
  }),
}));
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: s.activityFetch }));
vi.stubGlobal("navigateTo", s.navigateTo);
vi.stubGlobal("useDiscordSDK", () => ({
  isDiscordActivity: { value: true },
  channelId: { value: "c-1" },
  getSdk: () => s.sdk,
}));

import { useActivityPlay } from "~/composables/useActivityPlay";

const LOBBY = { id: "l-1", code: "ABCD", hostUserId: "u-1" };

function setup() {
  const scope = effectScope();
  const api = scope.run(() => useActivityPlay())!;
  return { scope, api };
}

describe("useActivityPlay", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useUserStore().user = { id: "u-1", name: "Alice" } as any;
    vi.clearAllMocks();
    s.sdk = { instanceId: "i-1" };
    s.getLobbyByInstanceId.mockResolvedValue(null);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flips hasLobby as by-instance changes and stops polling on dispose", async () => {
    vi.useFakeTimers();
    s.getLobbyByInstanceId.mockResolvedValueOnce(null).mockResolvedValue(LOBBY);
    const { scope, api } = setup();

    // Not flushPromises: it schedules on a timer, which fake timers freeze.
    await vi.advanceTimersByTimeAsync(0);
    expect(api.hasLobby.value).toBe(false);
    expect(s.getLobbyByInstanceId).toHaveBeenCalledWith("i-1");

    await vi.advanceTimersByTimeAsync(5000);
    expect(api.hasLobby.value).toBe(true);

    scope.stop();
    const calls = s.getLobbyByInstanceId.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15000);
    expect(s.getLobbyByInstanceId).toHaveBeenCalledTimes(calls);
  });

  it("initializes the doc when it created the lobby", async () => {
    s.activityFetch.mockResolvedValue({ lobby: LOBBY, created: true });
    const { api } = setup();

    await api.play();

    expect(s.activityFetch).toHaveBeenCalledWith("/api/lobby/activity-play", {
      method: "POST",
      body: { instanceId: "i-1", channelId: "c-1" },
    });
    expect(s.initializeCreatedLobby).toHaveBeenCalledWith(LOBBY);
    expect(s.joinLobby).not.toHaveBeenCalled();
    expect(s.navigateTo).toHaveBeenCalledWith("/game/ABCD");
  });

  it("joins when the lobby already existed", async () => {
    s.activityFetch.mockResolvedValue({ lobby: LOBBY, created: false });
    const { api } = setup();

    await api.play();

    expect(s.joinLobby).toHaveBeenCalledWith("ABCD", { username: "Alice" });
    expect(s.initializeCreatedLobby).not.toHaveBeenCalled();
    expect(s.navigateTo).toHaveBeenCalledWith("/game/ABCD");
  });

  it("never calls /api/lobby/active", async () => {
    // A user hosting a web lobby must still get the instance's game.
    s.activityFetch.mockResolvedValue({ lobby: LOBBY, created: true });
    const { api } = setup();

    await api.play();

    const urls = s.activityFetch.mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["/api/lobby/activity-play"]);
  });

  it("reports failure inline and clears busy", async () => {
    s.activityFetch.mockRejectedValue(new Error("boom"));
    const { api } = setup();

    await api.play();

    expect(api.failed.value).toBe(true);
    expect(api.busy.value).toBe(false);
    expect(s.navigateTo).not.toHaveBeenCalled();
  });

  it("clears a previous failure on the next press", async () => {
    s.activityFetch.mockRejectedValueOnce(new Error("boom"));
    s.activityFetch.mockResolvedValue({ lobby: LOBBY, created: false });
    const { api } = setup();

    await api.play();
    expect(api.failed.value).toBe(true);
    await api.play();
    expect(api.failed.value).toBe(false);
  });

  it("ignores a second press while busy", async () => {
    let resolve!: (v: unknown) => void;
    s.activityFetch.mockReturnValue(new Promise((r) => (resolve = r)));
    const { api } = setup();

    const first = api.play();
    await api.play();
    expect(api.busy.value).toBe(true);
    resolve({ lobby: LOBBY, created: false });
    await first;

    expect(s.activityFetch).toHaveBeenCalledTimes(1);
  });

  it("fails without an instance id", async () => {
    s.sdk = null;
    const { api } = setup();

    await api.play();

    expect(api.failed.value).toBe(true);
    expect(s.activityFetch).not.toHaveBeenCalled();
  });
});
