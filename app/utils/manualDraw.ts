/**
 * How many cards a player can draw from the deck right now, under manual draw.
 *
 * The one number behind every manual-draw hint: the dashed slots in the hand,
 * the badge on the deck and the phone's Draw button. It mirrors what
 * `engine.drawCards` accepts — a judge or a player who has already played this
 * round is refused there — so the UI never invites a tap that does nothing.
 */
export function manualDrawSlots(input: {
  manualDraw: boolean;
  handSize: number;
  cardsPerPlayer: number;
  isJudge: boolean;
  isParticipant: boolean;
  hasSubmitted: boolean;
}): number {
  if (!input.manualDraw || input.isJudge || !input.isParticipant || input.hasSubmitted) {
    return 0;
  }
  return Math.max(0, input.cardsPerPlayer - input.handSize);
}
