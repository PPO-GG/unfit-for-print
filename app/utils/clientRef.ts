/**
 * A random v4 uuid for feedback's client_ref. crypto.randomUUID exists only
 * in secure contexts, and phones testing `pnpm dev` over http://192.168.x.x
 * are not one — getRandomValues is available everywhere, so build it by hand
 * there.
 */
export function makeClientRef(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
