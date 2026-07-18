import type { AdminNavSection, AdminUserSummary } from "~/types/admin";
import { ADMIN_NAV, ADMIN_USER } from "~/composables/useAdminMockData";

/**
 * Admin sidebar navigation + current admin user summary.
 *
 * Currently returns static mock data. When session-derived admin metadata
 * is wired up, replace `user` with data from the user store.
 */
export function useAdminNav() {
  const nav = readonly(ref<AdminNavSection[]>(ADMIN_NAV));
  const user = readonly(ref<AdminUserSummary>(ADMIN_USER));
  return { nav, user };
}
