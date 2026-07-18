import type {
  AdminActionItem,
  AdminActivityEntry,
  AdminHealthRow,
  AdminKpi,
  AdminRevenueSummary,
  AdminTopServer,
} from "~/types/admin";
import {
  ADMIN_ACTION_ITEMS,
  ADMIN_ACTIVITY,
  ADMIN_HEALTH,
  ADMIN_KPI_SPARKS,
  ADMIN_KPIS,
  ADMIN_REVENUE,
  ADMIN_TOP_SERVERS,
} from "~/composables/useAdminMockData";
import { useUserStore } from "~/stores/userStore";

/**
 * Overview page data: KPIs, activity feed, action items, system health,
 * revenue, top servers.
 *
 * Partially wired:
 *   - `actionItems[reports]` count is derived from /api/admin/reports
 *   - `health` Game-server row is derived from /api/admin/teleportal/status
 *
 * Still mocked (no telemetry pipeline yet):
 *   - KPIs, sparks, activity feed, revenue, top servers
 *   See ADMIN_INTEGRATION_STATUS.md for the planned backing.
 */
export function useAdminOverview() {
  const userStore = useUserStore();

  const kpis = readonly(ref<AdminKpi[]>(ADMIN_KPIS));
  const sparks = readonly(ref<Record<string, number[]>>(ADMIN_KPI_SPARKS));
  const activity = readonly(ref<AdminActivityEntry[]>(ADMIN_ACTIVITY));
  const revenue = readonly(ref<AdminRevenueSummary>(ADMIN_REVENUE));
  const topServers = readonly(ref<AdminTopServer[]>(ADMIN_TOP_SERVERS));

  const actionItems = ref<AdminActionItem[]>([...ADMIN_ACTION_ITEMS]);
  const health = ref<AdminHealthRow[]>([...ADMIN_HEALTH]);

  const authHeaders = () => ({
    Authorization: `Bearer ${userStore.session?.$id}`,
    "x-appwrite-user-id": userStore.user?.$id ?? "",
  });

  async function loadRealCounts() {
    try {
      const res = await $fetch<{ reports: unknown[] }>("/api/admin/reports", {
        headers: authHeaders(),
      });
      const count = (res.reports ?? []).length;
      const i = actionItems.value.findIndex(a => a.to === "/admin/reports");
      if (i >= 0) {
        actionItems.value[i] = {
          ...actionItems.value[i]!,
          count: String(count),
        };
      }
    } catch (err) {
      console.warn("[useAdminOverview] report count unavailable:", err);
    }
  }

  async function loadTeleportalHealth() {
    try {
      const res = await $fetch<{
        server: { activeClients: number; activeDocuments: number; uptime: number };
      }>("/api/admin/teleportal/status", { headers: authHeaders() });
      const s = res.server;
      const uptimeHrs = Math.floor(s.uptime / 3600);
      const i = health.value.findIndex(h => h.label === "Game server");
      if (i >= 0) {
        health.value[i] = {
          label: "Game server",
          value: `${s.activeClients} clients`,
          sub: `${s.activeDocuments} docs · up ${uptimeHrs}h`,
          ok: true,
        };
      }
    } catch (err) {
      const i = health.value.findIndex(h => h.label === "Game server");
      if (i >= 0) {
        health.value[i] = {
          label: "Game server",
          value: "unreachable",
          sub: "teleportal status failed",
          warn: true,
        };
      }
      console.warn("[useAdminOverview] teleportal status unavailable:", err);
    }
  }

  if (import.meta.client) {
    loadRealCounts();
    loadTeleportalHealth();
  }

  return { kpis, sparks, activity, actionItems, health, revenue, topServers };
}
