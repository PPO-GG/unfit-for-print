import type { IssueContext, IssueKind } from "~/types/issue";
import {
  APP_VERSION_MAX,
  ISSUE_CONTEXT_KEYS,
  ISSUE_KINDS,
  LOBBY_CODE_MAX,
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

const isHandSizes = (v: unknown): boolean =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v as object).length <= 32 &&
  Object.values(v as Record<string, unknown>).every(isFiniteNumber);

/**
 * Per-key value guards. The key allowlist governs which fields may exist;
 * this governs what they may hold. Both halves are needed — an
 * unauthenticated caller can put a chat transcript under `phase` just as
 * easily as under a key nobody allowed.
 */
const CONTEXT_VALUE_GUARDS: Record<string, (v: unknown) => boolean> = {
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
};

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
  const stack = clamp(body.stack, STACK_MAX);

  return {
    ok: true,
    value: {
      kind: kind as IssueKind,
      message,
      title: message.slice(0, TITLE_MAX),
      stack,
      lobbyCode: clamp(body.lobbyCode, LOBBY_CODE_MAX),
      route: clamp(body.route, ROUTE_MAX),
      platform: clamp(body.platform, PLATFORM_MAX),
      appVersion: clamp(body.appVersion, APP_VERSION_MAX) ?? "unknown",
      context,
      fingerprint: computeFingerprint({
        kind: kind as IssueKind,
        message,
        stack: stack ?? undefined,
        context: context ?? undefined,
      }),
    },
  };
}
