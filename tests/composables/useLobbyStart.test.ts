import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useLobbyStart } from "~/composables/useLobbyStart";

const p = (userId: string, ready: boolean, playerType = "player") =>
  ({ $id: userId, userId, name: userId, ready, playerType }) as any;

function setup(isHost = true) {
  const players = ref([p("u1", true), p("u2", false), p("b1", false, "bot")]);
  const isHostRef = ref(isHost);
  const isStarting = ref(false);
  const onStart = vi.fn();
  const scope = effectScope();
  const api = scope.run(() =>
    useLobbyStart({
      players,
      myId: ref("u1"),
      isHost: isHostRef,
      isStarting,
      onStart,
    }),
  )!;
  return { players, onStart, api, scope, isHost: isHostRef, isStarting };
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

  it("fires at the 5s mark if the user becomes host mid-countdown", async () => {
    const { players, onStart, isHost } = setup(false);
    players.value = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    await nextTick();
    vi.advanceTimersByTime(3000);
    isHost.value = true;
    vi.advanceTimersByTime(1999);
    expect(onStart).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("restarts the countdown, and starts again, after canStart drops and returns", async () => {
    const { players, api, onStart } = setup(true);
    const ready = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    players.value = ready;
    await nextTick();
    vi.advanceTimersByTime(5000);
    expect(onStart).toHaveBeenCalledTimes(1);
    players.value = [p("u1", true), p("u2", false), p("b1", false, "bot")];
    await nextTick();
    expect(api.countdown.value).toBeNull();
    players.value = ready;
    await nextTick();
    expect(api.countdown.value).toBe(5);
    vi.advanceTimersByTime(5000);
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it("re-arms Start after a failed start (isStarting true then false)", async () => {
    const { players, api, onStart, isStarting } = setup(true);
    players.value = [p("u1", true), p("u2", true), p("b1", false, "bot")];
    await nextTick();
    api.handleStart();
    expect(onStart).toHaveBeenCalledTimes(1);
    isStarting.value = true;
    await nextTick();
    isStarting.value = false;
    await nextTick();
    api.handleStart();
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
