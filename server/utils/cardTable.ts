import { whiteCards, blackCards } from "../db/schema";

export function cardTable(type: string) {
  if (type === "white") return whiteCards;
  if (type === "black") return blackCards;
  throw createError({ statusCode: 400, statusMessage: "type must be 'white' or 'black'" });
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
