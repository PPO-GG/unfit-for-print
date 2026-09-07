/**
 * Geometry for the admin card grid, which virtualises by row.
 *
 * `useVirtualList` needs a flat list of fixed-height items; a grid only has
 * that if you treat a *row* as the item. So the column count has to be
 * derived from the container width first, then the cards chunked into rows.
 * Both halves are pure so the maths can be tested without a DOM.
 */
export const GRID_MIN_TILE = 200;
export const GRID_GAP = 12;

export function gridGeometry(
  containerWidth: number,
  minTile: number = GRID_MIN_TILE,
  gap: number = GRID_GAP,
): { columns: number; tileWidth: number } {
  const width = Math.max(0, containerWidth);
  // n tiles need (n-1) gaps: solve n*minTile + (n-1)*gap <= width
  const columns = Math.max(1, Math.floor((width + gap) / (minTile + gap)));
  const tileWidth = (width - (columns - 1) * gap) / columns;
  return { columns, tileWidth: Math.max(minTile, tileWidth) };
}

export function chunkRows<T>(items: T[], columns: number): T[][] {
  const width = Math.max(1, Math.floor(columns) || 1);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += width) {
    rows.push(items.slice(i, i + width));
  }
  return rows;
}
