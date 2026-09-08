import type { IssueContext, IssueKind } from "~/types/issue";
import {
  ISSUE_CONTEXT_KEYS,
  ISSUE_KINDS,
  MESSAGE_MAX,
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

/** Rebuilds the context from an explicit key list rather than deleting
 *  unknown keys, so a key nobody anticipated cannot reach the column. */
function pickContext(raw: unknown): IssueContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ISSUE_CONTEXT_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
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

  return {
    ok: true,
    value: {
      kind: kind as IssueKind,
      message,
      title: message.slice(0, TITLE_MAX),
      stack: clamp(body.stack, STACK_MAX),
      lobbyCode: clamp(body.lobbyCode, 16),
      route: clamp(body.route, ROUTE_MAX),
      platform: clamp(body.platform, 32),
      appVersion: clamp(body.appVersion, 32) ?? "unknown",
      context,
      fingerprint: computeFingerprint({
        kind: kind as IssueKind,
        message,
        stack: clamp(body.stack, STACK_MAX) ?? undefined,
        context: context ?? undefined,
      }),
    },
  };
}
