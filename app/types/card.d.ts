/** Positioning config for full-bleed picture cards — pan (offset) + zoom
 *  (scale) applied on top of an object-fit: cover baseline. No rotation: a
 *  card image is meant to sit flush in the frame like it's printed. */
export interface CardAttachmentConfig {
  offsetX: number; // fraction of card width, -0.5 to 0.5
  offsetY: number; // fraction of card height, -0.5 to 0.5
  scale: number; // zoom multiplier on top of the cover baseline, 1.0 to 3.0
}

export type CardImageFormat = "png" | "webp" | "jpeg";
