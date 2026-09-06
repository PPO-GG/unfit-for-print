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
