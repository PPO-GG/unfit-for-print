const MIN_SCALE = 0.6;
const FREE_CARD_BUDGET = 6;

export function getJudgingCardScale(
  groupCount: number,
  cardCount: number,
): number {
  const density = Math.max(groupCount, cardCount);

  if (density <= FREE_CARD_BUDGET) return 1;

  return Math.max(MIN_SCALE, 1 - (density - FREE_CARD_BUDGET) * 0.05);
}
