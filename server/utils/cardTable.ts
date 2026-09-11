import { whiteCards, blackCards } from "../db/schema";

export function cardTable(type: string) {
  if (type === "white") return whiteCards;
  if (type === "black") return blackCards;
  throw createError({ statusCode: 400, statusMessage: "type must be 'white' or 'black'" });
}

/** The game deals at most 3 cards per prompt — game/start.post.ts clamps maxPick the same way. */
export function assertValidPick(pick: unknown): asserts pick is number {
  if (!Number.isInteger(pick) || (pick as number) < 1 || (pick as number) > 3) {
    throw createError({ statusCode: 400, statusMessage: "pick must be a whole number from 1 to 3" });
  }
}

export function assertCardHasContent(text: unknown, imageFileId: unknown) {
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasImage = typeof imageFileId === "string" && imageFileId.length > 0;
  if (hasText && hasImage) {
    throw createError({
      statusCode: 400,
      statusMessage: "A card can have text or an image, not both",
    });
  }
  if (!hasText && !hasImage) {
    throw createError({
      statusCode: 400,
      statusMessage: "A card needs either text or an image",
    });
  }
}
