/**
 * Constructs a same-origin URL for a card image stored in R2. Served by the
 * `server/api/cards/images/[key].get.ts` proxy route, which streams the
 * object straight from the R2 bucket.
 */
export function getCardImageUrl(fileId: string): string {
  return `/api/cards/images/${fileId}`;
}
