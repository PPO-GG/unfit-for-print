import type { AdminModerationSubmission } from "~/types/admin";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import { useUserStore } from "~/stores/userStore";

/**
 * Moderation queue — reviews user-submitted cards from Labs.
 *
 * Wired to the real `submission` collection (the same one Labs uses
 * on the player-facing side). `approve` adopts the card into the
 * appropriate white/black pack ("Unfit Labs") and then deletes the
 * submission; `reject` deletes the submission via the admin endpoint;
 * `sendToPlaytest` is a local-only state change today — the schema has
 * no `status` column yet. See ADMIN_INTEGRATION_STATUS.md.
 */
export function useAdminModeration() {
  const userStore = useUserStore();
  const { tables } = getAppwrite();
  const config = useRuntimeConfig();

  const DB_ID = config.public.appwriteDatabaseId as string;
  const SUB_ID = config.public.appwriteSubmissionCollectionId as string;
  const BLACK = config.public.appwriteBlackCardCollectionId as string;
  const WHITE = config.public.appwriteWhiteCardCollectionId as string;

  const submissions = ref<AdminModerationSubmission[]>([]);
  const loading = ref(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${userStore.session?.$id}`,
    "x-appwrite-user-id": userStore.user?.$id ?? "",
  });

  function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function deriveStatus(row: Record<string, any>): AdminModerationSubmission["status"] {
    const created = String(row.$createdAt ?? "");
    if (!created) return "pending";
    const ageH = (Date.now() - new Date(created).getTime()) / 3_600_000;
    return ageH < 24 ? "pending" : "playtest";
  }

  function transform(row: Record<string, any>): AdminModerationSubmission {
    return {
      id: row.$id,
      kind: row.cardType === "black" ? "prompt" : "answer",
      text: row.text ?? "",
      picks: typeof row.pick === "number" ? row.pick : undefined,
      author: row.submitterName ?? "anon",
      date: row.$createdAt ? formatRelative(row.$createdAt) : "—",
      up: Number(row.upvotes ?? 0),
      down: 0,
      status: deriveStatus(row),
    };
  }

  async function refresh() {
    if (!tables) return;
    loading.value = true;
    try {
      const res = await tables.listRows({
        databaseId: DB_ID,
        tableId: SUB_ID,
        queries: [Query.orderDesc("$createdAt"), Query.limit(100)],
      });
      submissions.value = res.rows.map((r: any) => transform(r));
    } catch (err) {
      console.error("[useAdminModeration] refresh failed:", err);
      submissions.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function approve(id: string) {
    const sub = submissions.value.find(s => s.id === id);
    if (!sub || !tables) return;
    try {
      // Adopt: create the card in the appropriate target pack
      const tableId = sub.kind === "prompt" ? BLACK : WHITE;
      const data: Record<string, any> = {
        text: sub.text,
        pack: "Unfit Labs",
        active: true,
        submittedBy: sub.author,
      };
      if (sub.kind === "prompt" && sub.picks) data.pick = sub.picks;
      await tables.createRow({
        databaseId: DB_ID,
        tableId,
        rowId: "unique()",
        data,
      });
      // Delete original submission via admin endpoint
      await $fetch("/api/admin/submissions/delete", {
        method: "POST",
        headers: authHeaders(),
        body: { submissionId: id },
      });
      submissions.value = submissions.value.filter(s => s.id !== id);
    } catch (err) {
      console.error("[useAdminModeration] approve failed:", err);
    }
  }

  async function reject(id: string) {
    try {
      await $fetch("/api/admin/submissions/delete", {
        method: "POST",
        headers: authHeaders(),
        body: { submissionId: id },
      });
      submissions.value = submissions.value.filter(s => s.id !== id);
    } catch (err) {
      console.error("[useAdminModeration] reject failed:", err);
    }
  }

  async function sendToPlaytest(id: string) {
    // No `status` column on the submission schema yet — local-only.
    const row = submissions.value.find(s => s.id === id);
    if (row) row.status = "playtest";
  }

  if (import.meta.client) {
    refresh();
  }

  return { submissions, loading, refresh, approve, reject, sendToPlaytest };
}
