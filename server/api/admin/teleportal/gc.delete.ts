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
  const target = `${url}/gc/${encodeURIComponent(body.docId)}`;

  try {
    const result = await $fetch(target, { method: "DELETE" });
    return result;
  } catch (err: any) {
    console.error(
      `[admin/teleportal/gc] Failed to GC ${body.docId}:`,
      err?.data || err?.message || err,
    );
    throw createError({
      statusCode: err?.statusCode || 502,
      statusMessage:
        err?.data?.error || err?.message || `Failed to GC lobby ${body.docId}`,
    });
  }
});
