// utils/uuid.ts
// Universal UUID v4 generator that works in all environments:
// - Browser (including non-secure HTTP contexts during local dev)
// - Node.js / Nitro server runtime
// - SSR
//
// Prefers crypto.randomUUID() when available, falls back to
// crypto.getRandomValues()-based generation.

export function uuid(): string {
  // Fast path: native randomUUID (secure browser contexts + Node 19+)
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  // Fallback: manual UUID v4 via getRandomValues
  // Works in all browsers (even non-secure contexts) and Node.js
  const bytes = new Uint8Array(16);
  (globalThis.crypto ?? require("node:crypto")).getRandomValues(bytes);

  // Set version (4) and variant (10xx) bits per RFC 4122
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
