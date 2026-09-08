import { createHash, randomUUID } from "node:crypto";
import type { IssueContext, IssueKind } from "~/types/issue";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LOBBY_DOC_RE = /lobby-[A-Z0-9]+/gi;
const QUOTED_RE = /"[^"]*"|'[^']*'/g;
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

export function computeFingerprint(input: {
  kind: IssueKind;
  message: string;
  stack?: string;
  context?: IssueContext;
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
      : `${input.kind}|${normalizeMessage(input.message)}|${topFrame(input.stack)}`;

  return createHash("sha256").update(basis).digest("hex");
}
