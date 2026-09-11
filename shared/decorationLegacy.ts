/**
 * Pre-studio decorations stored one image plus an `attachment` positioning
 * blob. Reads convert those on the fly instead of migrating the rows, because
 * the database has no backups and the conversion is cheap.
 */
import { normalizeLayers, type DecorationLayers } from "./decorationLayers";

export interface LegacyDecorationRow {
  imageKey?: string | null;
  imageFormat?: string | null;
  attachment?: unknown;
  layers?: unknown;
}

const ANCHORS: Record<string, [number, number]> = {
  "top-left": [-0.5, -0.5],
  "top-center": [0, -0.5],
  "top-right": [0.5, -0.5],
  center: [0, 0],
  "bottom-center": [0, 0.5],
};

/** What the old editor wrote when the admin never touched the sliders. */
const LEGACY_DEFAULT: Record<string, unknown> = {
  anchor: "top-center", offsetX: 0, offsetY: -0.35, scale: 0.6,
  rotation: 0, speed: 1, zLayer: "above", clipped: false,
};

const n = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);

export function legacyAttachmentToLayers(row: LegacyDecorationRow): DecorationLayers {
  const format = row.imageFormat;
  if (!row.imageKey || !format) return { v: 1, layers: [] };

  const raw = row.attachment && typeof row.attachment === "object" ? (row.attachment as Record<string, unknown>) : {};
  const a = { ...LEGACY_DEFAULT, ...raw };
  const [ax, ay] = ANCHORS[String(a.anchor)] ?? ANCHORS["top-center"]!;
  const common = {
    id: "legacy",
    side: a.zLayer === "below" ? "behind" : "front",
    clip: a.clipped === true,
    transform: {
      x: ax + n(a.offsetX, 0),
      y: ay + n(a.offsetY, 0),
      scale: n(a.scale, 0.6),
      rotation: n(a.rotation, 0),
    },
  };
  const asset = { key: row.imageKey, format };
  const layer =
    format === "lottie" || format === "dotlottie"
      ? { ...common, type: "lottie", name: "Animation", asset, speed: n(a.speed, 1) }
      : { ...common, type: "image", name: "Image", asset };
  return normalizeLayers({ v: 1, layers: [layer] });
}

/** A saved stack always wins; legacy columns are only read when it's null. */
export function resolveLayers(row: LegacyDecorationRow): DecorationLayers {
  return row.layers != null ? normalizeLayers(row.layers) : legacyAttachmentToLayers(row);
}
