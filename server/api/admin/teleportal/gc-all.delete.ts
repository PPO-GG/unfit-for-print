// server/api/admin/teleportal/gc-all.delete.ts
// Proxies Teleportal DELETE /gc to force GC all lobbies.

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const url = getTeleportalHttpUrl();
  return $fetch(`${url}/gc`, { method: "DELETE" });
});
