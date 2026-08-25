/**
 * Constructs a same-origin URL for a decoration image stored in R2.
 * Served by the `server/api/decorations/images/[key].get.ts` proxy route,
 * which streams the object straight from the R2 bucket.
 */
export function getDecorationImageUrl(fileId: string): string {
  return `/api/decorations/images/${fileId}`;
}
