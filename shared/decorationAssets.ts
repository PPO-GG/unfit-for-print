/**
 * R2 key helpers for decoration assets. Legacy keys are `${uuid}-${original
 * filename}` with unsanitised names (spaces, unicode), so the safety rule
 * mirrors what the image route has always accepted rather than an allowlist.
 */
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
