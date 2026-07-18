/**
 * Labs submissions — real Appwrite integration.
 *
 * Wraps the `submission` collection (fetch + realtime subscribe +
 * upvote + admin delete/adopt). Extracted from the legacy
 * `pages/labs.vue` body so the new design's components can consume
 * a clean `LabsSubmission[]` stream.
 *
 * Stubs (merged in via `deriveStatus` / `deriveTrend`):
 *   - status: the existing schema has no moderation/graduation state,
 *     so every submission is reported as `"new"` or `"playtest"` based
 *     on age — the graduated/rejected buckets are empty here.
 *   - trend: `"hot"` if upvotes > 15 in the last 24h, otherwise null.
 *
 * See docs/ui-overhaul-future-features.md → Labs for the wiring plan.
 */

import { Query } from "appwrite";
import type { LabsSubmission } from "~/types/labs";
import { getAppwrite } from "~/utils/appwrite";

// Shared avatar palette so the same submitter always gets the same
// color. Hash the name to pick a slot; color-blind-safe enough for a
// small demo set and deterministic across reloads.
const AVATAR_BGS = [
  "oklch(78% 0.20 195)",
  "oklch(72% 0.22 355)",
  "oklch(80% 0.20 140)",
  "oklch(82% 0.18 95)",
  "oklch(70% 0.22 260)",
  "oklch(72% 0.18 20)",
  "oklch(78% 0.18 50)",
  "oklch(74% 0.20 175)",
  "oklch(76% 0.18 320)",
];
function authorBgFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_BGS[hash % AVATAR_BGS.length]!;
}

function initialsFor(name: string): string {
  const s = (name ?? "").trim();
  if (!s) return "??";
  const parts = s.split(/\s+/);
  const [first, second] = parts;
  if (parts.length >= 2 && first && second) {
    return (first[0]! + second[0]!).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const mins = Math.max(1, Math.floor((now - then) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Derive status from age since creation — the schema doesn't track
// moderation state, so this is best-effort. Real system: read a
// `status` column once added.
function deriveStatus(
  row: Record<string, unknown>,
): LabsSubmission["status"] {
  const created = String(row.$createdAt ?? row.timestamp ?? "");
  if (!created) return "new";
  const ageHours = (Date.now() - new Date(created).getTime()) / 3_600_000;
  if (ageHours < 24) return "new";
  return "playtest";
}

function deriveTrend(row: Record<string, unknown>): LabsSubmission["trend"] {
  const up = Number(row.upvotes ?? 0);
  const created = String(row.$createdAt ?? row.timestamp ?? "");
  const ageHours = created
    ? (Date.now() - new Date(created).getTime()) / 3_600_000
    : 9999;
  return up >= 15 && ageHours < 48 ? "hot" : null;
}

function transform(row: Record<string, unknown>): LabsSubmission {
  const name = String(row.submitterName ?? "ANON");
  return {
    id: String(row.$id),
    kind: row.cardType === "black" ? "prompt" : "answer",
    text: String(row.text ?? ""),
    pick: typeof row.pick === "number" ? row.pick : undefined,
    author: name.toUpperCase(),
    initials: initialsFor(name),
    authorBg: authorBgFor(name),
    date: formatRelative(String(row.$createdAt ?? row.timestamp ?? "")),
    timestamp: String(row.$createdAt ?? row.timestamp ?? ""),
    up: Number(row.upvotes ?? 0),
    down: 0, // no downvote column yet — see future-features doc.
    upvoterIds: Array.isArray(row.upvoterIds) ? (row.upvoterIds as string[]) : [],
    status: deriveStatus(row),
    trend: deriveTrend(row),
  };
}

export function useLabsSubmissions() {
  const userStore = useUserStore();
  const isAdmin = useIsAdmin();
  const config = useRuntimeConfig();
  const toast = useToast();

  const rawRows = ref<Record<string, unknown>[]>([]);
  const loading = ref(true);
  const upvoteInFlight = ref<string | null>(null);

  const submissions = computed<LabsSubmission[]>(() =>
    rawRows.value.map(transform),
  );

  const isLoggedIn = computed(() =>
    Boolean(userStore.user?.$id && userStore.session?.$id),
  );

  async function fetchAll() {
    if (!import.meta.client) return;
    const { tables } = getAppwrite();
    if (!tables) return;

    try {
      loading.value = true;
      const res = await tables.listRows({
        databaseId: config.public.appwriteDatabaseId as string,
        tableId: config.public.appwriteSubmissionCollectionId as string,
        queries: [Query.orderDesc("$createdAt"), Query.limit(100)],
      });
      rawRows.value = res.rows as Record<string, unknown>[];
    } catch (err) {
      console.error("[labs] fetch submissions failed", err);
      toast.add({
        title: "Error",
        description: "Failed to load submissions",
        color: "error",
      });
    } finally {
      loading.value = false;
    }
  }

  async function upvote(submissionId: string) {
    if (!isLoggedIn.value || upvoteInFlight.value) return;
    const { tables } = getAppwrite();
    if (!tables) return;

    const idx = rawRows.value.findIndex((r) => r.$id === submissionId);
    if (idx === -1) return;
    const row = rawRows.value[idx]!;
    const userId = userStore.user!.$id;
    const upvoters = Array.isArray(row.upvoterIds)
      ? (row.upvoterIds as string[])
      : [];
    const already = upvoters.includes(userId);
    const nextUpvotes = Number(row.upvotes ?? 0) + (already ? -1 : 1);
    const nextUpvoters = already
      ? upvoters.filter((id) => id !== userId)
      : [...upvoters, userId];

    try {
      upvoteInFlight.value = submissionId;
      const updated = await tables.updateRow({
        databaseId: config.public.appwriteDatabaseId as string,
        tableId: config.public.appwriteSubmissionCollectionId as string,
        rowId: submissionId,
        data: {
          upvotes: nextUpvotes,
          upvoterIds: nextUpvoters,
        },
      });
      rawRows.value[idx] = updated as Record<string, unknown>;
    } catch (err) {
      console.error("[labs] upvote failed", err);
      toast.add({
        title: "Error",
        description: "Failed to update vote",
        color: "error",
      });
    } finally {
      upvoteInFlight.value = null;
    }
  }

  async function adminDelete(submissionId: string) {
    if (!isAdmin.value) return;
    try {
      await $fetch("/api/admin/submissions/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userStore.session!.$id}`,
          "x-appwrite-user-id": userStore.user!.$id,
        },
        body: { submissionId },
      });
      rawRows.value = rawRows.value.filter((r) => r.$id !== submissionId);
      toast.add({
        title: "Deleted",
        description: "Submission removed",
        color: "success",
      });
    } catch (err) {
      console.error("[labs] delete failed", err);
      toast.add({
        title: "Error",
        description: "Failed to delete submission",
        color: "error",
      });
    }
  }

  async function adminAdopt(submission: LabsSubmission) {
    if (!isAdmin.value) return;
    const { tables } = getAppwrite();
    if (!tables) return;

    try {
      const collectionId =
        submission.kind === "answer"
          ? (config.public.appwriteWhiteCardCollectionId as string)
          : (config.public.appwriteBlackCardCollectionId as string);

      const cardData: Record<string, unknown> = {
        text: submission.text,
        pack: "Unfit Labs",
        active: true,
        submittedBy: submission.author,
      };
      if (submission.kind === "prompt" && submission.pick) {
        cardData.pick = submission.pick;
      }

      await tables.createRow({
        databaseId: config.public.appwriteDatabaseId as string,
        tableId: collectionId,
        rowId: "unique()",
        data: cardData,
      });
      await tables.deleteRow({
        databaseId: config.public.appwriteDatabaseId as string,
        tableId: config.public.appwriteSubmissionCollectionId as string,
        rowId: submission.id,
      });

      rawRows.value = rawRows.value.filter((r) => r.$id !== submission.id);
      toast.add({
        title: "Adopted!",
        description: "Card moved into the Unfit Labs pack",
        color: "success",
      });
    } catch (err) {
      console.error("[labs] adopt failed", err);
      toast.add({
        title: "Error",
        description: "Failed to adopt submission",
        color: "error",
      });
    }
  }

  // ─── Realtime subscription ─────────────────────────────────
  let unsub: (() => void) | undefined;
  function subscribe() {
    if (!import.meta.client) return;
    const { client } = getAppwrite();
    if (!client) return;

    const dbId = config.public.appwriteDatabaseId as string;
    const collectionId = config.public.appwriteSubmissionCollectionId as string;

    unsub = client.subscribe(
      [`databases.${dbId}.collections.${collectionId}.documents`],
      (res: { events: string[]; payload: Record<string, unknown> }) => {
        const { events, payload } = res;
        if (events.some((e) => e.endsWith(".create"))) {
          if (!rawRows.value.some((r) => r.$id === payload.$id)) {
            rawRows.value.unshift(payload);
          }
        } else if (events.some((e) => e.endsWith(".update"))) {
          const idx = rawRows.value.findIndex((r) => r.$id === payload.$id);
          if (idx !== -1) rawRows.value[idx] = payload;
        } else if (events.some((e) => e.endsWith(".delete"))) {
          rawRows.value = rawRows.value.filter((r) => r.$id !== payload.$id);
        }
      },
    );
  }

  onMounted(() => {
    void fetchAll();
    subscribe();
  });
  onUnmounted(() => {
    unsub?.();
  });

  function prependNew(newRow: Record<string, unknown>) {
    if (!rawRows.value.some((r) => r.$id === newRow.$id)) {
      rawRows.value.unshift(newRow);
    }
  }

  return {
    submissions,
    loading,
    isLoggedIn,
    isAdmin,
    upvoteInFlight,
    upvote,
    adminDelete,
    adminAdopt,
    prependNew,
    fetchAll,
  };
}
