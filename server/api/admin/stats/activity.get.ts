// server/api/admin/stats/activity.get.ts
// Admin-only: lobbies created and distinct players over the last 24 hours.

import { getActivityStats } from "~~/server/utils/activity";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return getActivityStats();
});
