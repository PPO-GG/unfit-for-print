/**
 * R2 key helpers for decoration assets. Legacy keys are `${uuid}-${original
 * filename}` with unsanitised names (spaces, unicode), so the safety rule
 * mirrors what the image route has always accepted rather than an allowlist.
 */
import type { DecorationLayers } from "./decorationLayers";

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function isSafeAssetKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= 300 &&
    !CONTROL_CHARS.test(key) &&
    !key.includes("..") &&
    !key.includes("/")
  );
}

/** Every key uploaded by the studio starts with this; prune only looks here. */
export const DECO_KEY_PREFIX = "deco-";

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return cleaned || "file";
}

export function buildAssetKey(uuid: string, filename: string): string {
  return `${DECO_KEY_PREFIX}${uuid}-${sanitizeFilename(filename)}`;
}

/** Keys a decoration references: every layer asset plus its legacy image. */
export function collectAssetKeys(
  stack: DecorationLayers,
  legacyImageKey?: string | null,
): Set<string> {
  const keys = new Set<string>();
  for (const layer of stack.layers) {
    if ("asset" in layer && layer.asset) keys.add(layer.asset.key);
  }
  if (legacyImageKey && isSafeAssetKey(legacyImageKey)) keys.add(legacyImageKey);
  return keys;
}

export function removedAssetKeys(before: Iterable<string>, after: Set<string>): string[] {
  return [...before].filter((key) => !after.has(key));
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || "decoration";
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
