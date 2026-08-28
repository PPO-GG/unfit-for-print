import { whiteCards, blackCards } from "~~/server/db/schema";
import { packStats } from "~~/server/utils/packStats";

export default defineEventHandler(async () => {
  const [white, black] = await Promise.all([packStats(whiteCards), packStats(blackCards)]);
  return { white, black };
});
