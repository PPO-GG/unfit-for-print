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

import { expect, vi } from "vitest";
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

export interface InvariantOptions {
  /**
   * Rule ids this doc is allowed to trip, because the fixture is deliberately
   * unrealistic rather than wedged — a two-player seed built to exercise black
   * card selection will always read as `too-few-players`.
   *
   * Name them one at a time. A blanket opt-out turns the guard off.
   */
  except?: string[];
}

/**
 * Asserts the doc is in no state the watchdog would report.
 *
 * Call it after the assertions a test came for. The failure message names the
 * rule, so a stalled round reads as "submitting-settled" rather than as a
 * mystery in whichever field the test happened to check.
 */
export function expectNoWedgedState(
  stub: LobbyDocResult,
  opts: InvariantOptions = {},
): void {
  const except = new Set(opts.except ?? []);
  const snapshot = snapshotDoc(stub);
  const wedged = WATCHDOG_RULES.filter(
    (r) => !except.has(r.id) && r.detect(snapshot),
  ).map((r) => `${r.id}: ${r.describe(snapshot)}`);

  expect(wedged, `watchdog would report: ${wedged.join("; ")}`).toEqual([]);
}

// ── Whole-suite coverage ───────────────────────────────────────────────────
//
// Calling the assertion by hand only guards the tests someone remembered to
// add it to, which is the same gap that let both halves of the "cards stuck"
// report through. A suite registers its docs instead, and every test in it is
// checked.

interface TrackedDoc {
  stub: LobbyDocResult;
  opts: InvariantOptions;
}

let tracked: TrackedDoc[] = [];

/** Registers a doc for the end-of-test check. Returns it, so a suite's own
 *  `makeStubDoc()` can wrap its return value. */
export function watchDoc<T extends LobbyDocResult>(
  stub: T,
  opts: InvariantOptions = {},
): T {
  tracked.push({ stub, opts });
  return stub;
}

let perTest: string[] = [];

/**
 * Allows these rules for the current test only, on top of whatever its suite
 * already allows. For the case a suite cannot state up front: a test that
 * drives the engine into a state the watchdog names on purpose.
 */
export function allowWedged(...ruleIds: string[]): void {
  perTest.push(...ruleIds);
}

/** Rules describing a state the engine resolves on a timer rather than
 *  synchronously. Under real timers a test ends before they fire, so the doc
 *  is mid-transition, not wedged. */
const TIMER_RESOLVED_RULES = ["submitting-settled", "settle-stalled"];

/**
 * Checks every doc registered during the test, then clears the registry.
 * Wire it into a suite's `afterEach`.
 *
 * Pending timers run first. The engine settles a round it could not resolve
 * synchronously on a 1.5s timer, so a test that submits for everyone and then
 * ends is mid-transition, not wedged — asserting before that timer fires would
 * report every such test as a stalled round.
 */
export function expectTrackedDocsUnwedged(): void {
  const docs = tracked;
  const allowed = perTest;
  tracked = [];
  perTest = [];

  // A suite on fake timers can settle the round here and be held to every
  // rule. One on real timers cannot, so the rules a pending timer would clear
  // are skipped for it — checking them would report every test that ends on
  // the last submission. This is why the two suites that exist to test the
  // transition itself run on fake timers.
  const usingFakeTimers = vi.isFakeTimers();
  if (usingFakeTimers) vi.advanceTimersByTime(10_000);

  for (const { stub, opts } of docs) {
    expectNoWedgedState(stub, {
      except: [
        ...(opts.except ?? []),
        ...allowed,
        ...(usingFakeTimers ? [] : TIMER_RESOLVED_RULES),
      ],
    });
  }
}
