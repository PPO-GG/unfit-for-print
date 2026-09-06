/**
 * When the card table should forget the previous prompt's animation state.
 *
 * Pure and Vue-free so the rule can be tested without mounting GameTable.
 * A new prompt on the table is the real signal; it used to be inferred from
 * the judging → submitting phase edge, but a judge skipping a black card
 * swaps the prompt with no phase change at all.
 */

/** True when `promptSerial` genuinely advanced, not when it first appeared. */
export function isNewPrompt(
  next: number | undefined,
  prev: number | undefined,
): boolean {
  return next !== undefined && prev !== undefined && next !== prev;
}

/**
 * The pre-`promptSerial` fallback, for docs created before black-card skipping
 * shipped. Yields to the serial watcher as soon as the doc has one, so a round
 * advance never resets twice.
 */
export function isLegacyRoundStart(
  promptSerial: number | undefined,
  next: string,
  prev: string | undefined,
): boolean {
  return (
    promptSerial === undefined && next === "submitting" && prev === "judging"
  );
}

/**
 * Whether a change in the skip-announcement trigger should announce a skip.
 *
 * The trigger is the prompt serial while a skip is in effect and `undefined`
 * otherwise, so a real skip always reads as `undefined -> N`: `nextRound`
 * clears the skip flag every round, and a second skip in one round is refused
 * by the engine. Only two transitions must stay silent — falling back to
 * `undefined` when the next round clears the flag, and a value that did not
 * actually change. A late-joining client is already covered by the watcher not
 * being `immediate`.
 */
export function isSkipAnnouncement(
  next: number | undefined,
  prev: number | undefined,
): boolean {
  return next !== undefined && next !== prev;
}
