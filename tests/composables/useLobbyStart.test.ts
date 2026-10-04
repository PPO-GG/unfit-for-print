import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useLobbyStart } from "~/composables/useLobbyStart";

const p = (userId: string, ready: boolean, playerType = "player") =>
  ({ $id: userId, userId, name: userId, ready, playerType }) as any;

function setup(isHost = true) {
  const players = ref([p("u1", true), p("u2", false), p("b1", false, "bot")]);
  const onStart = vi.fn();
  const scope = effectScope();
  const api = scope.run(() =>
    useLobbyStart({
      players,
      myId: ref("u1"),
      isHost: ref(isHost),
      isStarting: ref(false),
      onStart,
    }),
  )!;
  return { players, onStart, api, scope };
}

describe("useLobbyStart", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("counts bots as ready and needs every human ready", () => {
    const { api } = setup();
    expect(api.readyCount.value).toBe(2);
    expect(api.allNonBotsReady.value).toBe(false);
    expect(api.myReady.value).toBe(true);
    expect(api.canStart.value).toBe(false);
  });

  it("auto-starts once after the countdown, host only", async () => {
    const { players, api, onStart } = setup(true);
    players.value = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    await nextTick();
    expect(api.countdown.value).toBe(5);
    vi.advanceTimersByTime(5000);
    expect(onStart).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("never auto-starts for a guest", async () => {
    const { players, onStart } = setup(false);
    players.value = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    await nextTick();
    vi.advanceTimersByTime(6000);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("cancels the countdown when someone un-readies", async () => {
    const { players, api } = setup(true);
    players.value = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    await nextTick();
    players.value = [p("u1", true), p("u2", false), p("b1", false, "bot")];
    await nextTick();
    expect(api.countdown.value).toBeNull();
  });

  it("start-now fires once and stops the countdown", async () => {
    const { players, api, onStart } = setup(true);
    players.value = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    await nextTick();
    api.handleStart();
    vi.advanceTimersByTime(6000);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("clears its timer when the scope is disposed", async () => {
    const { players, onStart, scope } = setup(true);
    players.value = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    await nextTick();
    scope.stop();
    vi.advanceTimersByTime(6000);
    expect(onStart).not.toHaveBeenCalled();
  });
});
