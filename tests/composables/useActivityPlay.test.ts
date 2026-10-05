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

vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: s.activityFetch }));
vi.stubGlobal("navigateTo", s.navigateTo);
vi.stubGlobal("useDiscordSDK", () => ({
  isDiscordActivity: { value: true },
  channelId: { value: "c-1" },
  getSdk: () => s.sdk,
}));

import { useActivityPlay } from "~/composables/useActivityPlay";

/** Someone else's game. */
const LOBBY = { id: "l-1", code: "ABCD", hostUserId: "u-host" };
/** A game the caller (u-1) hosts. */
const MINE = { id: "l-2", code: "MINE", hostUserId: "u-1" };

function setup() {
  const scope = effectScope();
  const api = scope.run(() =>
    useActivityPlay({
      getLobbyByInstanceId: s.getLobbyByInstanceId,
      initializeCreatedLobby: s.initializeCreatedLobby,
      joinLobby: s.joinLobby,
    }),
  )!;
  return { scope, api };
}

describe("useActivityPlay", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useUserStore().user = { id: "u-1", name: "Alice" } as any;
    vi.clearAllMocks();
    s.sdk = { instanceId: "i-1" };
    s.getLobbyByInstanceId.mockResolvedValue(null);
    s.joinLobby.mockResolvedValue(undefined);
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
    s.activityFetch.mockResolvedValue({ lobby: MINE, created: true });
    const { api } = setup();

    await api.play();

    expect(s.activityFetch).toHaveBeenCalledWith("/api/lobby/activity-play", {
      method: "POST",
      body: { instanceId: "i-1", channelId: "c-1" },
    });
    expect(s.initializeCreatedLobby).toHaveBeenCalledWith(MINE);
    expect(s.joinLobby).not.toHaveBeenCalled();
    expect(s.navigateTo).toHaveBeenCalledWith("/game/MINE");
  });

  it("joins when the lobby already existed", async () => {
    s.activityFetch.mockResolvedValue({ lobby: LOBBY, created: false });
    const { api } = setup();

    await api.play();

    expect(s.joinLobby).toHaveBeenCalledWith("ABCD", { username: "Alice" });
    expect(s.initializeCreatedLobby).not.toHaveBeenCalled();
    expect(s.navigateTo).toHaveBeenCalledWith("/game/ABCD");
  });

  it("sends a returning host straight to their game", async () => {
    // Their seat is already on the server. The game page restores their doc
    // if their first attempt never wrote it, whereas joinLobby would seat
    // them as a plain player in an empty doc that nobody can start.
    s.activityFetch.mockResolvedValue({ lobby: MINE, created: false });
    const { api } = setup();

    await api.play();

    expect(s.joinLobby).not.toHaveBeenCalled();
    expect(s.initializeCreatedLobby).not.toHaveBeenCalled();
    expect(s.navigateTo).toHaveBeenCalledWith("/game/MINE");
  });

  it("never calls /api/lobby/active", async () => {
    // A user hosting a web lobby must still get the instance's game.
    s.activityFetch.mockResolvedValue({ lobby: MINE, created: true });
    const { api } = setup();

    await api.play();

    const urls = s.activityFetch.mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["/api/lobby/activity-play"]);
  });

  it("reports failure inline and clears busy", async () => {
    s.activityFetch.mockRejectedValue(new Error("boom"));
    const { api } = setup();

    await api.play();

    expect(api.failure.value).toBe("error");
    expect(api.busy.value).toBe(false);
    expect(s.navigateTo).not.toHaveBeenCalled();
  });

  it("clears a previous failure on the next press", async () => {
    s.activityFetch.mockRejectedValueOnce(new Error("boom"));
    s.activityFetch.mockResolvedValue({ lobby: LOBBY, created: false });
    const { api } = setup();

    await api.play();
    expect(api.failure.value).toBe("error");
    await api.play();
    expect(api.failure.value).toBeNull();
  });

  it("says the game is locked when its password refuses the join", async () => {
    // Nobody in the Activity can enter a password, so "try again" would
    // never work.
    s.activityFetch.mockResolvedValue({ lobby: LOBBY, created: false });
    s.joinLobby.mockRejectedValue(
      Object.assign(new Error("Incorrect lobby password"), { statusCode: 403 }),
    );
    const { api } = setup();

    await api.play();

    expect(api.failure.value).toBe("locked");
    expect(s.navigateTo).not.toHaveBeenCalled();
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

    expect(api.failure.value).toBe("error");
    expect(s.activityFetch).not.toHaveBeenCalled();
  });
});
