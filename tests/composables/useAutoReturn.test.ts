import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computed, ref, effectScope } from "vue";

const engine = vi.hoisted(() => ({
  resetGame: vi.fn(),
  markReturnedToLobby: vi.fn(),
}));
vi.mock("~/composables/useYjsGameEngine", () => ({ useYjsGameEngine: () => engine }));
vi.mock("~/composables/useNotifications", () => ({ useNotifications: () => ({ notify: vi.fn() }) }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));

import { useAutoReturn, CELEBRATION_MS, PODIUM_SECONDS } from "~/composables/useAutoReturn";

const T0 = 1_800_000_000_000;

function setup({ host = true, returned = {} as Record<string, boolean> } = {}) {
  const state = ref<any>({ phase: "waiting", gameEndTime: null, returnedToLobby: {} });
  const isHost = ref(host);
  const scope = effectScope();
  const api = scope.run(() =>
    useAutoReturn({
      state: computed(() => state.value),
      myId: computed(() => "me"),
      isComplete: computed(() => state.value?.phase === "complete"),
      isHost: computed(() => isHost.value),
      lobbyRef: ref({ id: "l1" } as any),
      lobbyDoc: {} as any,
      resetGame: engine.resetGame,
    }),
  )!;
  const endGame = async () => {
    state.value = { phase: "complete", gameEndTime: Date.now(), returnedToLobby: returned };
    await Promise.resolve();
  };
  return { state, isHost, api, endGame, stop: () => scope.stop() };
}

describe("useAutoReturn — podium then back to the lobby", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(T0);
    engine.resetGame.mockClear();
    engine.markReturnedToLobby.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the podium for 10 seconds after the winning-card celebration", async () => {
    const { api, endGame, stop } = setup();
    await endGame();
    expect(PODIUM_SECONDS).toBe(10);
    expect(api.podiumSecondsLeft.value).toBe(10);
    vi.advanceTimersByTime(CELEBRATION_MS); // podium appears
    expect(api.podiumSecondsLeft.value).toBe(10);
    vi.advanceTimersByTime(4000);
    expect(api.podiumSecondsLeft.value).toBe(6);
    vi.advanceTimersByTime(6000);
    expect(api.podiumSecondsLeft.value).toBe(0);
    stop();
  });

  it("the host takes everyone back to the lobby when the podium time is up, once", async () => {
    const { api, endGame, stop } = setup({ host: true });
    await endGame();
    vi.advanceTimersByTime(CELEBRATION_MS + PODIUM_SECONDS * 1000 - 1000);
    expect(engine.resetGame).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(engine.resetGame).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000); // the doc may lag behind; never reset twice
    expect(engine.resetGame).toHaveBeenCalledTimes(1);
    expect(api.podiumSecondsLeft.value).toBe(0);
    stop();
  });

  it("a guest leaves the reset to the host", async () => {
    const { state, endGame, stop } = setup({ host: false });
    await endGame();
    vi.advanceTimersByTime(CELEBRATION_MS + PODIUM_SECONDS * 1000);
    expect(engine.resetGame).not.toHaveBeenCalled();
    // The host's reset arrives: the game is no longer complete.
    state.value = { phase: "waiting", gameEndTime: null, returnedToLobby: {} };
    await Promise.resolve();
    vi.advanceTimersByTime(10_000);
    expect(engine.resetGame).not.toHaveBeenCalled();
    stop();
  });

  // A host who closed the tab or backgrounded their phone would otherwise
  // strand everyone on the podium.
  it("a guest resets after a grace period if the host never does", async () => {
    const { endGame, stop } = setup({ host: false });
    await endGame();
    vi.advanceTimersByTime(CELEBRATION_MS + PODIUM_SECONDS * 1000 + 2000);
    expect(engine.resetGame).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(engine.resetGame).toHaveBeenCalledTimes(1);
    stop();
  });

  it("Back to lobby: the host brings everyone now", async () => {
    const { api, endGame, stop } = setup({ host: true });
    await endGame();
    await api.handleContinue();
    expect(engine.resetGame).toHaveBeenCalledTimes(1);
    stop();
  });

  it("Back to lobby: a guest goes ahead on their own", async () => {
    const { api, endGame, stop } = setup({ host: false });
    await endGame();
    await api.handleContinue();
    expect(engine.markReturnedToLobby).toHaveBeenCalledWith("me");
    expect(engine.resetGame).not.toHaveBeenCalled();
    stop();
  });

  it("knows when this player has gone ahead to the lobby", async () => {
    const { api, endGame, stop } = setup({ host: false, returned: { me: true } });
    expect(api.hasReturnedToLobby.value).toBe(false);
    await endGame();
    expect(api.hasReturnedToLobby.value).toBe(true);
    stop();
  });
});
