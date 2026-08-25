import { whiteCards, blackCards } from "../db/schema";

export function cardTable(type: string) {
  if (type === "white") return whiteCards;
  if (type === "black") return blackCards;
  throw createError({ statusCode: 400, statusMessage: "type must be 'white' or 'black'" });
}
