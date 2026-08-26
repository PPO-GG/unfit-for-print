// server/api/admin/teleportal/gc-all.delete.ts
// Proxies Teleportal POST /gc to force GC all lobbies.
// NOTE: The Teleportal server expects POST /gc for gc-all,
// and DELETE /gc/:docId for single-lobby GC.

import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const url = getTeleportalHttpUrl();
  return $fetch(`${url}/gc`, { method: "POST" });
});
