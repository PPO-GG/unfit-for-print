// server/api/admin/teleportal/status.get.ts
// Proxies the Teleportal /status endpoint so it works inside Discord Activity iframes.

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const url = getTeleportalHttpUrl();
  return $fetch(`${url}/status`);
});
