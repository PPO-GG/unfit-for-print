import type { AdminAnnouncement } from "~/types/admin";
import { ADMIN_ANNOUNCEMENTS } from "~/composables/useAdminMockData";

/**
 * Announcements (banners + Discord-shareable notices).
 *
 * This is net-new functionality — see `docs/admin-ui-future-features.md`
 * for the planned backend schema. Until the Appwrite collection exists,
 * publishing is a no-op that just mutates local state.
 */
export function useAdminAnnouncements() {
  const announcements = ref<AdminAnnouncement[]>([...ADMIN_ANNOUNCEMENTS]);

  async function save(patch: AdminAnnouncement) {
    const i = announcements.value.findIndex(a => a.id === patch.id);
    if (i >= 0) announcements.value[i] = patch;
    else announcements.value.unshift(patch);
  }

  async function publish(id: string) {
    const row = announcements.value.find(a => a.id === id);
    if (row) row.status = "live";
  }

  async function end(id: string) {
    const row = announcements.value.find(a => a.id === id);
    if (row) row.status = "ended";
  }

  return { announcements, save, publish, end };
}
