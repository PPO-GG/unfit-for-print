// server/api/bot/decide.post.ts
//
// Asks Jev which cards a bot should play, or which submission a bot judge
// should pick. Read-only: it never touches the Y.Doc. The host's client
// (useBots) applies the answer through the Yjs engine and falls back to its old
// random behaviour whenever this answers null — so a missing key, a Jev outage
// or a timeout degrades bots to how they always were, and never stalls them.
//
// Multi-card prompts are filled one card at a time. Ranking every ordered pair
// at once handed Jev ~90 options and got back a near-flat distribution; one
// call per blank, each seeing the cards already chosen, gets a real preference
// (spike, 2026-10-05).

import { and, eq, inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { blackCards, players, whiteCards } from "~~/server/db/schema";
import {
  fillPrompt,
  judgeInstructions,
  playInstructions,
  sampleIndex,
} from "~~/server/utils/botChoice";
import { isCardId } from "~~/server/utils/cardIds";
import { JevError, jevChoose, jevConfigured } from "~~/server/utils/jev";
import { consumeRateLimit } from "~~/server/utils/rateLimit";
import { requirePlayerInLobby } from "~~/server/utils/session";

const MAX_HAND = 20;
const MAX_SUBMISSIONS = 20;
const MAX_CARDS_PER_SUBMISSION = 3;
const MAX_PICK = 3;
// A round asks at most ~6 times per lobby (five bots and a judge), and rounds
// take well over ten seconds, so 60/min is nowhere near real play — this stops
// a loop from spending Jev credit, it is not a quota.
const DECIDE_LIMIT = 60;
const DECIDE_WINDOW_MS = 60_000;
// The per-lobby bucket alone can be multiplied by joining many lobbies, so the
// whole process also has a ceiling. A busy bot lobby asks ~18 times a minute;
// past this, bots fall back to random play rather than spending more.
const DECIDE_GLOBAL_LIMIT = 600;

interface DecideBody {
  lobbyId?: unknown;
  mode?: unknown;
  blackCardId?: unknown;
  hand?: unknown;
  submissions?: unknown;
}

const badRequest = (statusMessage: string) =>
  createError({ statusCode: 400, statusMessage });

const isIdList = (value: unknown, max: number): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= max &&
  value.every(isCardId);

export default defineEventHandler(async (event) => {
  const body = ((await readBody<DecideBody>(event)) ?? {}) as DecideBody;
  const { lobbyId, mode, blackCardId } = body;

  if (!isCardId(lobbyId)) throw badRequest("lobbyId is required");
  if (mode !== "play" && mode !== "judge") {
    throw badRequest("mode must be play or judge");
  }
  if (!isCardId(blackCardId)) throw badRequest("blackCardId is required");

  let hand: string[] = [];
  let submissions: string[][] = [];
  if (mode === "play") {
    if (!isIdList(body.hand, MAX_HAND)) {
      throw badRequest(`hand must be 1-${MAX_HAND} card ids`);
    }
    hand = [...new Set(body.hand)];
  } else {
    const raw = body.submissions;
    if (
      !Array.isArray(raw) ||
      raw.length === 0 ||
      raw.length > MAX_SUBMISSIONS ||
      !raw.every((s) => isIdList(s, MAX_CARDS_PER_SUBMISSION))
    ) {
      throw badRequest(
        `submissions must be 1-${MAX_SUBMISSIONS} lists of 1-${MAX_CARDS_PER_SUBMISSION} card ids`,
      );
    }
    submissions = raw as string[][];
  }

  await requirePlayerInLobby(event, lobbyId);

  const db = useDb();

  // Only a lobby that actually holds a bot has anything to decide. Without
  // this, any member of any lobby could spend Jev credit.
  const [bot] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.lobbyId, lobbyId), eq(players.playerType, "bot")))
    .limit(1);
  if (!bot) {
    throw createError({ statusCode: 403, statusMessage: "No bots in this lobby" });
  }

  for (const [key, limit] of [
    [`bot-decide:${lobbyId}`, DECIDE_LIMIT],
    ["bot-decide:global", DECIDE_GLOBAL_LIMIT],
  ] as const) {
    const rateLimit = consumeRateLimit(key, { limit, windowMs: DECIDE_WINDOW_MS });
    if (!rateLimit.allowed) {
      setResponseHeader(event, "Retry-After", rateLimit.retryAfterSeconds);
      throw createError({ statusCode: 429, statusMessage: "Too many bot decisions" });
    }
  }

  const none = mode === "play" ? { cardIds: null } : { winnerIndex: null };
  if (!jevConfigured()) return none;

  const [black] = await db
    .select({ text: blackCards.text, pick: blackCards.pick })
    .from(blackCards)
    .where(and(eq(blackCards.id, blackCardId), eq(blackCards.active, true)));
  if (!black?.text) return none;
  // Narrowing does not reach into the callbacks below, so hold the text here.
  const blackText = black.text;

  const ids = mode === "play" ? hand : [...new Set(submissions.flat())];
  const rows = await db
    .select({ id: whiteCards.id, text: whiteCards.text })
    .from(whiteCards)
    .where(and(inArray(whiteCards.id, ids), eq(whiteCards.active, true)));
  const texts = new Map<string, string>();
  for (const row of rows) if (row.text) texts.set(row.id, row.text);
  if (ids.some((id) => !texts.has(id))) return none;

  const state = `Prompt card: ${fillPrompt(blackText, [])}`;

  try {
    if (mode === "judge") {
      const criteria = Object.fromEntries(
        submissions.map((cards, i) => [
          `s${i}`,
          fillPrompt(blackText, cards.map((id) => texts.get(id)!)),
        ]),
      );
      const probs = await jevChoose(state, judgeInstructions(), criteria);
      return {
        winnerIndex: sampleIndex(submissions.map((_, i) => probs[`s${i}`] ?? 0)),
      };
    }

    const cardsToChoose = Math.min(Math.max(black.pick, 1), MAX_PICK, hand.length);
    const remaining = [...hand];
    const chosen: string[] = [];
    for (let card = 1; card <= cardsToChoose; card++) {
      const chosenTexts = chosen.map((id) => texts.get(id)!);
      const criteria = Object.fromEntries(
        remaining.map((id, i) => [
          `c${i}`,
          fillPrompt(blackText, [...chosenTexts, texts.get(id)!]),
        ]),
      );
      const probs = await jevChoose(
        state,
        playInstructions(card, cardsToChoose),
        criteria,
      );
      const index = sampleIndex(remaining.map((_, i) => probs[`c${i}`] ?? 0));
      if (index === null) return none;
      chosen.push(remaining.splice(index, 1)[0]!);
    }
    return { cardIds: chosen };
  } catch (err) {
    // Status or failure kind only — card text never goes in the logs.
    console.warn(
      "[bot/decide] jev failed:",
      err instanceof JevError ? err.message : "unexpected error",
    );
    return none;
  }
});
