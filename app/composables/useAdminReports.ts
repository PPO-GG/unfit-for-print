import type { AdminCardReport, AdminUserReport } from "~/types/admin";
import { ADMIN_USER_REPORTS } from "~/composables/useAdminMockData";
import { useUserStore } from "~/stores/userStore";

/**
 * Open reports — both card-level and user-behavior.
 *
 * Card reports: wired to the existing /api/admin/reports endpoint (real
 * Appwrite-backed). The server returns enriched reports with card text,
 * pack, and active state.
 *
 * User reports: net-new. There is no user-report collection yet — see
 * ADMIN_INTEGRATION_STATUS.md. Until a backend exists, we fall back to
 * mock data so the UI still renders.
 */
export function useAdminReports() {
  const userStore = useUserStore();

  const cardReports = ref<AdminCardReport[]>([]);
  const userReports = ref<AdminUserReport[]>([...ADMIN_USER_REPORTS]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const authHeaders = () => ({
    Authorization: `Bearer ${userStore.session?.$id}`,
    "x-appwrite-user-id": userStore.user?.$id ?? "",
  });

  function formatDate(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function priorityFromReason(reason: string): AdminCardReport["priority"] {
    const lower = (reason || "").toLowerCase();
    if (lower.includes("slur") || lower.includes("hate") || lower.includes("harass"))
      return "high";
    if (lower.includes("inappropriate") || lower.includes("offensive")) return "med";
    return "low";
  }

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      const res = await $fetch<{ reports: Array<Record<string, any>> }>(
        "/api/admin/reports",
        { headers: authHeaders() },
      );
      cardReports.value = (res.reports ?? []).map((r): AdminCardReport => ({
        id: r.$id,
        target: r.cardText ? `"${r.cardText}"` : "[deleted card]",
        kind: r.cardType === "black" ? "prompt" : "answer",
        reason: r.reason ?? "",
        reporter: r.reportedBy ?? "anon",
        date: formatDate(r.$createdAt),
        priority: priorityFromReason(r.reason ?? ""),
      }));
    } catch (err: any) {
      console.error("[useAdminReports] fetch failed:", err);
      error.value = err?.message ?? "Failed to load reports";
      cardReports.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function dismissCardReport(id: string) {
    try {
      await $fetch("/api/admin/reports/dismiss", {
        method: "POST",
        headers: authHeaders(),
        body: { reportId: id },
      });
      cardReports.value = cardReports.value.filter(r => r.id !== id);
    } catch (err) {
      console.error("[useAdminReports] dismiss failed:", err);
    }
  }

  async function dismissUserReport(id: string) {
    // No backend yet — optimistic local removal only.
    userReports.value = userReports.value.filter(r => r.id !== id);
  }

  // Auto-load once per composable instance
  if (import.meta.client) {
    refresh();
  }

  return {
    cardReports,
    userReports,
    loading,
    error,
    refresh,
    dismissCardReport,
    dismissUserReport,
  };
}
