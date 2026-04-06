import type { Component } from "vue";

/** Code registry — maps decoration ID to its Vue component */
export interface DecorationRegistryEntry {
  component: () => Promise<{ default: Component }>;
}

/** Positioning config for image-overlay decorations (hats, glasses, etc.) */
export interface AttachmentConfig {
  anchor: "top-center" | "top-left" | "top-right" | "center" | "bottom-center";
  offsetX: number; // fraction of avatar size (-1.0 to 1.0)
  offsetY: number; // fraction of avatar size (-1.0 to 1.0)
  scale: number; // relative to avatar (0.1 to 2.0)
  speed: number; // playback speed multiplier for Lottie animations (0.1 to 3.0)
  rotation: number; // degrees (-180 to 180)
  zLayer: "above" | "below"; // render above or behind the avatar
  clipped: boolean; // mask to the avatar circle (inset mode)
}

/** Format of the uploaded decoration file */
export type ImageFormat = "png" | "webp" | "lottie" | "dotlottie";

/** Decoration type discriminator */
export type DecorationType = "effect" | "attachment";

/** DB catalog — all business metadata from the decorations collection */
export interface DecorationCatalogEntry {
  $id: string;
  decorationId: string;
  name: string;
  description: string;
  type: DecorationType;
  rarity: string;
  category: string;
  enabled: boolean;
  freeForAll: boolean;
  discordSkuId: string | null;
  price: number;
  sortOrder: number;
  imageFileId: string | null;
  imageFormat: ImageFormat | null;
  attachment: AttachmentConfig | null;
}
