/**
 * Immutable operations on a layer stack. The studio keeps the stack in one
 * ref under useRefHistory; every edit goes through these so each produces a
 * new object, which is what makes undo/redo snapshots cheap and correct.
 * Array order is bottom-to-top; the layer list shows each side top-first.
 */
import {
  createLayer, newLayerId, normalizeLayers, MAX_LAYERS,
  type DecorationLayers, type Layer, type LayerSide, type LayerType,
} from "#shared/decorationLayers";

export function sideLists(stack: DecorationLayers): { front: Layer[]; behind: Layer[] } {
  const topFirst = [...stack.layers].reverse();
  return {
    front: topFirst.filter((l) => l.side === "front"),
    behind: topFirst.filter((l) => l.side === "behind"),
  };
}

export function addLayer(stack: DecorationLayers, type: LayerType): { stack: DecorationLayers; id: string | null } {
  if (stack.layers.length >= MAX_LAYERS) return { stack, id: null };
  const layer = createLayer(type);
  return { stack: { v: 1, layers: [...stack.layers, layer] }, id: layer.id };
}

export function removeLayer(stack: DecorationLayers, id: string): DecorationLayers {
  return { v: 1, layers: stack.layers.filter((l) => l.id !== id) };
}

export function duplicateLayer(stack: DecorationLayers, id: string): { stack: DecorationLayers; id: string | null } {
  const index = stack.layers.findIndex((l) => l.id === id);
  if (index === -1 || stack.layers.length >= MAX_LAYERS) return { stack, id: null };
  const source = stack.layers[index]!;
  const copy = {
    ...structuredClone(source),
    id: newLayerId(),
    name: `${source.name ?? source.type} copy`.slice(0, 40),
  } as Layer;
  const layers = [...stack.layers];
  layers.splice(index + 1, 0, copy);
  return { stack: { v: 1, layers }, id: copy.id };
}

export function updateLayer(stack: DecorationLayers, id: string, patch: Record<string, unknown>): DecorationLayers {
  return {
    v: 1,
    layers: stack.layers.map((l) =>
      l.id === id ? (normalizeLayers({ v: 1, layers: [{ ...l, ...patch, id: l.id, type: l.type }] }).layers[0] ?? l) : l,
    ),
  };
}

export function moveLayer(stack: DecorationLayers, id: string, side: LayerSide, topIndex: number): DecorationLayers {
  const layer = stack.layers.find((l) => l.id === id);
  if (!layer) return stack;
  const moved = { ...layer, side } as Layer;
  const others = stack.layers.filter((l) => l.id !== id);
  const sameSide = others.filter((l) => l.side === side); // bottom-to-top
  const bottomIndex = Math.max(0, Math.min(sameSide.length, sameSide.length - topIndex));

  let insertAt: number;
  if (sameSide.length === 0) insertAt = side === "behind" ? 0 : others.length;
  else if (bottomIndex === sameSide.length) insertAt = others.indexOf(sameSide[sameSide.length - 1]!) + 1;
  else insertAt = others.indexOf(sameSide[bottomIndex]!);

  others.splice(insertAt, 0, moved);
  return { v: 1, layers: others };
}

export interface ListingFields {
  name: string;
  description: string;
  rarity: string;
  category: string;
  enabled: boolean;
  freeForAll: boolean;
  discordSkuId: string;
  price: number;
  sortOrder: number;
}

export function buildSavePayload(listing: ListingFields, stack: DecorationLayers): Record<string, unknown> {
  return {
    ...listing,
    name: listing.name.trim() || "Untitled decoration",
    discordSkuId: listing.discordSkuId?.trim() || null,
    price: Number(listing.price) || 0,
    sortOrder: Math.round(Number(listing.sortOrder) || 0),
    layers: normalizeLayers(stack),
  };
}
