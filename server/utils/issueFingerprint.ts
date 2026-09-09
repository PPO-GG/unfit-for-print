import { createHash, randomUUID } from "node:crypto";
import type { IssueContext, IssueKind } from "~/types/issue";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LOBBY_DOC_RE = /lobby-[A-Z0-9]+/gi;
// The single-quote arm requires non-word characters on the outside of both
// quotes. Without that guard, "hasn't picked, player's hand" reads the two
// contraction apostrophes as one quoted pair and swallows everything between
// them — turning two unrelated messages into the same normalized string.
const QUOTED_RE = /"[^"]*"|(?<![A-Za-z0-9])'[^']*'(?![A-Za-z0-9])/g;
const NUMBER_RE = /\b\d+(\.\d+)?\b/g;

/**
 * Replaces the parts of a message that vary per occurrence, so the same bug
 * hashes to one group.
 *
 * Bare 4-char lobby codes are deliberately NOT normalized. The alphabet is
 * ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (randomCode() in
 * server/api/lobby/create.post.ts), so a blanket [A-HJ-NP-Z2-9]{4} rule
 * would also rewrite ordinary uppercase words — HTTP and TEXT both match.
 * A surviving bare code splits one bug across a few groups, which the admin
 * view makes visible; silently corrupting every four-letter acronym would
 * be worse and invisible.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(UUID_RE, "<uuid>")
    .replace(LOBBY_DOC_RE, "lobby-<code>")
    .replace(QUOTED_RE, "<str>")
    .replace(NUMBER_RE, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** First stack frame only. Deeper frames vary with minification and inlining
 *  and would fragment one bug into many groups. */
function topFrame(stack?: string): string {
  if (!stack) return "";
  const first = stack.split("\n").find((line) => line.trim().length > 0) ?? "";
  return normalizeMessage(first);
}

// Anchored, non-global. UUID_RE above carries the `g` flag for use with
// .replace() over free text — reusing it with .test() here would be
// stateful across calls (lastIndex persists on a global-flagged regex),
// giving intermittently wrong results for the exact same input.
const UUID_SEGMENT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOBBY_CODE_SEGMENT_RE = /^[A-HJ-NP-Z2-9]{4}$/i;
const NUMERIC_SEGMENT_RE = /^\d+$/;
/** Anything this long in a path segment is an opaque id/key (storage keys,
 *  tokens), not a route word — no legitimate static segment in this app's
 *  routes is anywhere near this long. */
const OPAQUE_SEGMENT_MIN_LENGTH = 24;

/**
 * Collapses the dynamic parts of a URL path so repeat failures of one route
 * group together regardless of which lobby/card/user triggered them.
 *
 * Deliberately separate from normalizeMessage(): that function leaves bare
 * lobby codes alone specifically because they can collide with real English
 * words in prose ("HTTP", "TEXT"). A URL path segment is never prose — a
 * segment that IS a lobby code should always collapse, since grouping one
 * dynamic route's failures together is the entire point here.
 */
export function normalizeRoute(route: string): string {
  return route
    .split("/")
    .map((segment) => {
      if (segment.length === 0) return segment;
      if (UUID_SEGMENT_RE.test(segment)) return "<uuid>";
      if (LOBBY_CODE_SEGMENT_RE.test(segment)) return "<code>";
      if (NUMERIC_SEGMENT_RE.test(segment)) return "<id>";
      if (segment.length >= OPAQUE_SEGMENT_MIN_LENGTH) return "<token>";
      return segment;
    })
    .join("/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function computeFingerprint(input: {
  kind: IssueKind;
  message: string;
  stack?: string;
  context?: IssueContext;
  route?: string;
}): string {
  // Free text must not be collapsed — two players describing different bugs
  // in similar words are two problems, not one.
  if (input.kind === "player-report") {
    return createHash("sha256")
      .update(`player-report|${randomUUID()}`)
      .digest("hex");
  }

  const basis =
    input.kind === "anomaly"
      ? `anomaly|${input.context?.ruleId ?? "unknown"}|${input.context?.phase ?? "unknown"}`
      : input.kind === "api-error"
        ? // Route + method + status, not the message: a route that 500s with a
          // different DB error each time is still one problem, not many.
          `api-error|${input.context?.method ?? "unknown"}|${normalizeRoute(input.route ?? "unknown")}|${input.context?.statusCode ?? "unknown"}`
        : `${input.kind}|${normalizeMessage(input.message)}|${topFrame(input.stack)}`;

  return createHash("sha256").update(basis).digest("hex");
}
