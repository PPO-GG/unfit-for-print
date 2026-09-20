// The watchdog's rules, run as test post-conditions.
//
// WATCHDOG_RULES already encodes what a wedged game looks like — that is its
// whole job — but in production it only reports, after the round is already
// lost. The same predicates are assertions when a test drives the engine: any
// sequence of actions that leaves the doc in a state the watchdog would report
// is a bug, whatever the test was actually checking.
//
// This exists because both halves of the "cards stuck" report were states the
// watchdog could describe and no test ever looked for. Engine suites asserted
// the field they were about (the submission survived, the deck was chunked)
// and never asked whether the round could still move.

import { expect } from "vitest";
import { WATCHDOG_RULES, type WatchdogSnapshot } from "~/utils/watchdogRules";
import { readSubmissions } from "~/utils/submissions";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";

function parse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Builds the watchdog's view of a doc, the way useGameWatchdog does. */
export function snapshotDoc(stub: LobbyDocResult): WatchdogSnapshot {
  const gs = stub.getGameState();

  const activePlayerIds: string[] = [];
  for (const [pid, raw] of stub.getPlayers().entries()) {
    const p = parse<{ playerType?: string }>(raw, {});
    if (p.playerType !== "spectator") activePlayerIds.push(pid);
  }

  const handSizes: Record<string, number> = {};
  for (const [pid, raw] of stub.getHands().entries()) {
    handSizes[pid] = parse<string[]>(raw, []).length;
  }

  return {
    phase: gs.get("phase") as WatchdogSnapshot["phase"],
    judgeId: (gs.get("judgeId") as string | null) ?? null,
    activePlayerIds,
    submittedPlayerIds: Object.keys(
      readSubmissions(gs, stub.getSubmissions()),
    ),
    skippedPlayerIds: parse<string[]>(gs.get("skippedPlayers"), []),
    handSizes,
    cardsPerPlayer: parse<number>(stub.getSettings().get("cardsPerPlayer"), 10),
  };
}

/**
 * Asserts the doc is in no state the watchdog would report.
 *
 * Call it after the assertions a test came for. The failure message names the
 * rule, so a stalled round reads as "submitting-settled" rather than as a
 * mystery in whichever field the test happened to check.
 */
export function expectNoWedgedState(stub: LobbyDocResult): void {
  const snapshot = snapshotDoc(stub);
  const wedged = WATCHDOG_RULES.filter((r) => r.detect(snapshot)).map((r) =>
    r.describe(snapshot),
  );

  expect(wedged, `watchdog would report: ${wedged.join("; ")}`).toEqual([]);
}
