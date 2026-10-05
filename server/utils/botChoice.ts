// server/utils/botChoice.ts
//
// Pure helpers for POST /api/bot/decide: turning a prompt plus candidate
// cards into the completed sentences Jev ranks, and sampling one pick from the
// distribution it returns. Sampling rather than taking Jev's top choice keeps
// bots varied — its top option usually carries only 20–50% (spike,
// 2026-10-05), and bland or off-prompt cards sit near zero either way.

import type { BotPersona } from "~~/server/utils/botNames";

// The result only ever goes to Jev as plain text, never into HTML. Tags are
// stripped until none are left (one pass can expose another, e.g.
// "<<b>script>"), then any stray bracket goes too.
function stripTags(text: string): string {
  let previous: string;
  let current = text;
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, "");
  } while (current !== previous);
  return current.replace(/[<>]/g, "").trim();
}

const cleanFill = (text: string) => stripTags(text).replace(/\.$/, "");

/**
 * The prompt with each blank (a run of underscores) taking the next fill in
 * `[brackets]`. Blanks without a fill stay `_`. Fills with no blank left —
 * every fill, for a prompt like "Make a haiku." — go after it, ` / `-joined.
 */
export function fillPrompt(blackText: string, fills: string[]): string {
  const cleaned = fills.map(cleanFill);
  let used = 0;
  const filled = stripTags(blackText).replace(/_+/g, () =>
    used < cleaned.length ? `[${cleaned[used++]}]` : "_",
  );
  const leftover = cleaned.slice(used);
  if (leftover.length === 0) return filled;
  const separator = used > 0 ? " / " : " ";
  return `${filled}${separator}${leftover.join(" / ")}`;
}

/**
 * A random index, weighted by `probs`. Entries that are not finite positive
 * numbers are never picked; null when no entry is pickable.
 */
export function sampleIndex(
  probs: number[],
  rng: () => number = Math.random,
): number | null {
  const weights = probs.map((p) => (Number.isFinite(p) && p > 0 ? p : 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return null;

  let remaining = rng() * total;
  let last: number | null = null;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] === 0) continue;
    last = i;
    remaining -= weights[i]!;
    if (remaining < 0) return i;
  }
  // Float drift can leave `remaining` a hair above zero at the end.
  return last;
}

const HOUSE =
  "This is a round of Cards Against Humanity, an adult party game where dark, absurd, and offensive humor wins.";

const FAVOR =
  "Favor answers that are surprising, clever, or shockingly fitting for the prompt over answers that are bland or don't fit.";

// Calibrated 2026-10-05: dark and absurd picked different top cards on 17/20
// prompts, and each differed from the crowd-pleaser on 14/20. The fit clause
// keeps a taste from ignoring the prompt; don't drop it without re-running.
const FIT = " — while still answering the prompt";

const TASTE: Record<Exclude<BotPersona, "crowd">, (card: "completed" | "submitted") => string> = {
  dark: (card) =>
    `Which ${card} card is the darkest and most shocking — the one that makes people gasp before they laugh${FIT}?`,
  absurd: (card) =>
    `Which ${card} card is the most absurd and surreal — the funniest pure nonsense${FIT}?`,
};

/** Instructions for choosing card `card` (1-based) of a prompt taking `of`. */
export function playInstructions(
  card: number,
  of: number,
  persona: BotPersona = "crowd",
): string {
  const question =
    persona !== "crowd"
      ? TASTE[persona]("completed")
      : of <= 1
        ? `Which completed card would make a group of friends laugh hardest? ${FAVOR}`
        : `Which choice makes the funniest card, or sets up the funniest finish? ${FAVOR}`;
  if (of <= 1) return `${HOUSE} ${question}`;
  const later = card < of ? " Cards still to be chosen are shown as _." : "";
  return `${HOUSE} The prompt takes ${of} cards and you are choosing card ${card} of ${of}.${later} ${question}`;
}

/** Instructions for a bot judge picking among submissions. */
export function judgeInstructions(persona: BotPersona = "crowd"): string {
  const question =
    persona !== "crowd"
      ? TASTE[persona]("submitted")
      : `Which submitted card would make a group of friends laugh hardest? ${FAVOR}`;
  return `${HOUSE} You are the judge. ${question}`;
}
