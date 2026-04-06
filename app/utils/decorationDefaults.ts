import type { AttachmentConfig } from "~/types/decoration";

/** Default attachment config for new decorations */
export const DEFAULT_ATTACHMENT_CONFIG: AttachmentConfig = {
  anchor: "top-center",
  offsetX: 0,
  offsetY: -0.35,
  scale: 0.6,
  speed: 1,
  rotation: 0,
  zLayer: "above",
  clipped: false,
};
