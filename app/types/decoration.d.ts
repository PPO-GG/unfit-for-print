import type { Component } from "vue";

/** Code registry — maps decoration ID to its Vue component */
export interface DecorationRegistryEntry {
  component: () => Promise<{ default: Component }>;
}

/** DB catalog — all business metadata from the decorations collection */
export interface DecorationCatalogEntry {
  $id: string;
  decorationId: string;
  name: string;
  description: string;
  type: string;
  rarity: string;
  enabled: boolean;
  freeForAll: boolean;
  discordSkuId: string | null;
  price: number;
  sortOrder: number;
}
