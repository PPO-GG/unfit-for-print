/**
 * Normalizes an Appwrite field that may be either a flat string ID
 * or a relationship object (`{ $id: "..." }`).
 *
 * Appwrite real-time payloads return relationship fields as objects,
 * while server-side SDK calls and REST responses return flat strings.
 * This utility handles both cases so callers can always use strict `===`.
 *
 * @param value - A string ID, a relationship object, or nullish
 * @returns The flat string ID, or an empty string if the input is nullish
 */
export function resolveId(
  value: string | { $id: string } | null | undefined,
): string {
  if (!value) return "";
  if (typeof value === "object" && "$id" in value) return value.$id;
  if (typeof value === "string") return value;
  return "";
}
