// server/utils/uuid.ts
// Re-exports the universal UUID generator for server-side (Nitro) auto-import.
// Nitro auto-imports from server/utils/, while the client uses app/utils/.

import { randomUUID } from "node:crypto";

export function uuid(): string {
  return randomUUID();
}
