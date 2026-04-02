// server/api/admin/teleportal/gc.delete.ts
// Proxies Teleportal DELETE /gc/:docId to force-remove a single lobby.

import { readBody, createError } from "h3";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody<{ docId?: string }>(event);
  if (!body.docId) {
    throw createError({ statusCode: 400, statusMessage: "Missing docId" });
  }

  const url = getTeleportalHttpUrl();
  return $fetch(`${url}/gc/${encodeURIComponent(body.docId)}`, {
    method: "DELETE",
  });
});
