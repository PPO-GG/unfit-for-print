import type { IssueContext, IssueKind } from "~/types/issue";
import {
  ANOMALY_RULE_IDS,
  APP_VERSION_MAX,
  GAME_PHASES,
  ISSUE_CONTEXT_KEYS,
  ISSUE_KINDS,
  MESSAGE_MAX,
  PLATFORM_MAX,
  ROUTE_MAX,
  STACK_MAX,
  TITLE_MAX,
} from "./issueConstants";
import { computeFingerprint } from "./issueFingerprint";

export interface NormalizedIssue {
  kind: IssueKind;
  message: string;
  title: string;
  stack: string | null;
  lobbyCode: string | null;
  route: string | null;
  platform: string | null;
  appVersion: string;
  context: IssueContext | null;
  fingerprint: string;
}

export type NormalizeResult =
  | { ok: true; value: NormalizedIssue }
  | { ok: false; reason: string };

/** Truncate rather than reject. A client sending a 9KB stack has still found
 *  a real bug; losing the report to a validation error would be the worse
 *  outcome. */
function clamp(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

/** Longest string any context field may carry. The real values are short —
 *  "submitting-complete" is 19 characters and a uuid is 36 — so this is
 *  loose enough for every legitimate value and tight enough that no one
 *  smuggles prose through a field named `phase`. */
const CONTEXT_STRING_MAX = 64;

const isShortString = (v: unknown): boolean =>
  typeof v === "string" && v.length > 0 && v.length <= CONTEXT_STRING_MAX;

const isFiniteNumber = (v: unknown): boolean =>
  typeof v === "number" && Number.isFinite(v);

const isHttpStatusCode = (v: unknown): boolean =>
  isFiniteNumber(v) && (v as number) >= 100 && (v as number) <= 599;

/** Player id → hand size. Guards keys as well as values — a value-only guard
 *  leaves the key wide open, and an attacker can smuggle an arbitrarily
 *  large string (a chat transcript, say) through a map key just as easily as
 *  through a value. `handSizes` is not populated by any client today, so
 *  without this an unauthenticated caller was the only thing that could ever
 *  reach here. */
const isHandSizes = (v: unknown): boolean =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v as object).length <= 32 &&
  Object.entries(v as Record<string, unknown>).every(
    ([key, size]) => isShortString(key) && isFiniteNumber(size),
  );

/**
 * Per-key value guards. The key allowlist governs which fields may exist;
 * this governs what they may hold. Both halves are needed — an
 * unauthenticated caller can put a chat transcript under `phase` just as
 * easily as under a key nobody allowed.
 *
 * Typed off ISSUE_CONTEXT_KEYS rather than a bare `Record<string, ...>` so
 * that adding a key to the allowlist without adding its guard here is a
 * compile error, not a silent fail-closed drop discovered later.
 */
const CONTEXT_VALUE_GUARDS: Record<
  (typeof ISSUE_CONTEXT_KEYS)[number],
  (v: unknown) => boolean
> = {
  phase: isShortString,
  round: isFiniteNumber,
  judgeId: isShortString,
  activePlayerCount: isFiniteNumber,
  submissionCount: isFiniteNumber,
  handSizes: isHandSizes,
  whiteDeckCount: isFiniteNumber,
  blackDeckCount: isFiniteNumber,
  isHost: (v) => typeof v === "boolean",
  ruleId: isShortString,
  category: isShortString,
  method: isShortString,
  statusCode: isHttpStatusCode,
};

/** Real lobby codes are exactly 4 characters from the alphabet `randomCode()`
 *  in `server/api/lobby/create.post.ts` draws from (no I/O/0/1, to avoid
 *  visual ambiguity). `lobbyCode` keys an in-memory rate-limit bucket in the
 *  ingest route and populates `issue_events_lobby_code_idx`, so an attacker
 *  who could set it to arbitrary text could mint unbounded distinct bucket
 *  keys and index entries. A malformed code is dropped, not rejected — the
 *  report describes a real bug either way. */
const LOBBY_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/;

function normalizeLobbyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return LOBBY_CODE_PATTERN.test(upper) ? upper : null;
}

/** Rebuilds the context from an explicit key list rather than deleting
 *  unknown keys, so a key nobody anticipated cannot reach the column. */
function pickContext(raw: unknown): IssueContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ISSUE_CONTEXT_KEYS) {
    if (source[key] !== undefined) {
      const guard = CONTEXT_VALUE_GUARDS[key];
      if (guard && guard(source[key])) {
        out[key] = source[key];
      }
    }
  }
  return Object.keys(out).length > 0 ? (out as IssueContext) : null;
}

export function normalizeIssuePayload(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "body must be an object" };
  }
  const body = raw as Record<string, unknown>;

  const kind = body.kind;
  if (typeof kind !== "string" || !ISSUE_KINDS.includes(kind as IssueKind)) {
    return { ok: false, reason: "unknown kind" };
  }

  const message = clamp(body.message, MESSAGE_MAX);
  if (!message) return { ok: false, reason: "message is required" };

  const context = pickContext(body.context);

  // An anomaly's fingerprint is ruleId + phase, so an unbounded pair means an
  // unbounded number of permanent group rows. Both halves have to be known
  // values or the report is refused outright — the watchdog only ever sends
  // ids from WATCHDOG_RULES, so nothing legitimate is turned away.
  if (kind === "anomaly") {
    if (!ANOMALY_RULE_IDS.includes(context?.ruleId as never)) {
      return { ok: false, reason: "unknown anomaly ruleId" };
    }
    if (!GAME_PHASES.includes(context?.phase as never)) {
      return { ok: false, reason: "unknown anomaly phase" };
    }
  }

  const stack = clamp(body.stack, STACK_MAX);
  const route = clamp(body.route, ROUTE_MAX);

  return {
    ok: true,
    value: {
      kind: kind as IssueKind,
      message,
      title: message.slice(0, TITLE_MAX),
      stack,
      lobbyCode: normalizeLobbyCode(body.lobbyCode),
      route,
      platform: clamp(body.platform, PLATFORM_MAX),
      appVersion: clamp(body.appVersion, APP_VERSION_MAX) ?? "unknown",
      context,
      fingerprint: computeFingerprint({
        kind: kind as IssueKind,
        message,
        stack: stack ?? undefined,
        context: context ?? undefined,
        route: route ?? undefined,
      }),
    },
  };
}
