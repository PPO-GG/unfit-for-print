import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { useGameWatchdog } from "~/composables/useGameWatchdog";

const reportMock = vi.fn();
vi.mock("~/composables/useIssueReporter", () => ({
  useIssueReporter: () => ({ report: reportMock }),
}));

describe("useGameWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reportMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeMockReactive(overrides: Partial<any> = {}) {
    return {
      isHost: ref(true),
      gameState: ref({
        phase: "submitting-complete",
        round: 1,
        judgeId: "judge-1",
        submissions: {},
        skippedPlayers: [],
        ...overrides.gameState,
      }),
      playerList: ref([
        { $id: "judge-1", playerType: "player" },
        { $id: "p-2", playerType: "player" },
        { $id: "p-3", playerType: "player" },
        ...(overrides.playerList ?? []),
      ]),
      hands: ref({
        "judge-1": ["c1"],
        "p-2": ["c2"],
        "p-3": ["c3"],
        ...overrides.hands,
      }),
      settings: ref({
        cardsPerPlayer: 10,
        manualDraw: false,
        ...overrides.settings,
      }),
    } as any;
  }

  it("reports settle-stalled and invokes recoverSettleStalled when phase stays submitting-complete past threshold", () => {
    const reactive = makeMockReactive({
      gameState: { phase: "submitting-complete" },
    });
    const recoverDeparted = vi.fn();
    const recoverSettled = vi.fn();
    const recoverSettleStalled = vi.fn();

    useGameWatchdog(reactive, recoverDeparted, recoverSettled, recoverSettleStalled);

    // Tick 1 (15s): condition first detected, records since = 15_000
    vi.advanceTimersByTime(15_000);
    expect(reportMock).not.toHaveBeenCalled();

    // Tick 2 (30s): held for 15s >= 10s threshold -> fires and recovers
    vi.advanceTimersByTime(15_000);

    expect(reportMock).toHaveBeenCalledTimes(1);
    expect(reportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "anomaly",
        context: expect.objectContaining({ ruleId: "settle-stalled" }),
      }),
    );
    expect(recoverSettleStalled).toHaveBeenCalledTimes(1);
    expect(recoverDeparted).not.toHaveBeenCalled();
    expect(recoverSettled).not.toHaveBeenCalled();
  });

  it("reports judge-missing and invokes recoverDeparted", () => {
    const reactive = makeMockReactive({
      gameState: { phase: "judging", judgeId: "ghost" },
    });
    const recoverDeparted = vi.fn();
    const recoverSettled = vi.fn();
    const recoverSettleStalled = vi.fn();

    useGameWatchdog(reactive, recoverDeparted, recoverSettled, recoverSettleStalled);

    // Tick 1 (15s): records since
    vi.advanceTimersByTime(15_000);
    // Tick 2 (30s): held for 15s >= 15s threshold -> fires and recovers
    vi.advanceTimersByTime(15_000);

    expect(reportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "anomaly",
        context: expect.objectContaining({ ruleId: "judge-missing" }),
      }),
    );
    expect(recoverDeparted).toHaveBeenCalledTimes(1);
    expect(recoverSettleStalled).not.toHaveBeenCalled();
  });

  it("reports submitting-settled and invokes recoverSettled", () => {
    const reactive = makeMockReactive({
      gameState: {
        phase: "submitting",
        submissions: { "p-2": ["c2"], "p-3": ["c3"] },
      },
    });
    const recoverDeparted = vi.fn();
    const recoverSettled = vi.fn();
    const recoverSettleStalled = vi.fn();

    useGameWatchdog(reactive, recoverDeparted, recoverSettled, recoverSettleStalled);

    // Tick 1 (15s): condition detected
    vi.advanceTimersByTime(15_000);
    // Tick 2 (30s): held for 15s (< 20s threshold for submitting-settled)
    vi.advanceTimersByTime(15_000);
    // Tick 3 (45s): held for 30s (>= 20s threshold) -> fires and recovers
    vi.advanceTimersByTime(15_000);

    expect(recoverSettled).toHaveBeenCalledTimes(1);
    expect(recoverSettleStalled).not.toHaveBeenCalled();
  });

  it("does not report or recover when the client is not the host", () => {
    const reactive = makeMockReactive({
      gameState: { phase: "submitting-complete" },
    });
    reactive.isHost.value = false;

    const recoverSettleStalled = vi.fn();
    useGameWatchdog(reactive, undefined, undefined, recoverSettleStalled);

    vi.advanceTimersByTime(60_000);

    expect(reportMock).not.toHaveBeenCalled();
    expect(recoverSettleStalled).not.toHaveBeenCalled();
  });
});
