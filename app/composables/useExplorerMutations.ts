/**
 * Every write the Explorer performs, by pack id. Each method calls its route,
 * reports the outcome, and returns whether it succeeded; the page reloads the
 * roster and cards after a success rather than patching local state — the old
 * hand-maintained mirror is what let counts drift from the database.
 */
import { ref } from "vue";
import type { AdminCard, AdminCardType, AdminPack } from "~/types/adminCard";
import { isPackDisabled, packTotal } from "~/utils/packListView";
import { packToDraft, type PackDraft } from "~/utils/packDraft";
import { useNotifications } from "~/composables/useNotifications";
import { useConfirm } from "~/composables/useConfirm";

export type { PackDraft };

const MOVE_CHUNK = 500;
const PICK_CHUNK = 1000;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const orNull = (s: string) => (s.trim() ? s.trim() : null);

function byType(cards: AdminCard[]) {
  const groups = new Map<AdminCardType, AdminCard[]>();
  for (const c of cards) groups.set(c.type, [...(groups.get(c.type) ?? []), c]);
  return groups;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function useExplorerMutations() {
  const { $activityFetch } = useNuxtApp();
  const { notify } = useNotifications();
  const { confirm } = useConfirm();
  const busy = ref(false);

  const post = (url: string, body: Record<string, unknown>) =>
    $activityFetch(url, { method: "POST", body });

  /** Run a mutation with `busy` set, turning a throw into a failure toast. */
  async function run(failTitle: string, work: () => Promise<void>, success?: string) {
    busy.value = true;
    try {
      await work();
      if (success) notify({ title: success, color: "success" });
      return true;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status !== 409) notify({ title: failTitle, color: "error" });
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function savePack(p: AdminPack, d: PackDraft) {
    const name = d.name.trim();
    return run(
      "Could not save the pack",
      async () => {
        try {
          await post("/api/admin/cards/pack-meta", {
            id: p.id,
            ...(name && name !== p.name ? { name } : {}),
            description: orNull(d.description),
            icon: orNull(d.icon),
            color: orNull(d.color),
            series: orNull(d.series),
            sortOrder: Number(d.sortOrder) || 0,
            official: d.official,
            nsfw: d.nsfw,
          });
        } catch (err) {
          if ((err as { statusCode?: number })?.statusCode === 409) {
            notify({
              title: "Name already taken",
              description: `A pack named "${name}" already exists — select both packs and use Merge into… instead.`,
              color: "warning",
            });
          }
          throw err;
        }
        if (d.isDefault !== p.isDefault) {
          await post("/api/admin/cards/toggle-default-pack", { packId: p.id, isDefault: d.isDefault });
        }
        if (d.active !== !isPackDisabled(p)) {
          await post("/api/admin/cards/toggle-pack", { packId: p.id, type: "all", active: d.active });
        }
      },
      "Pack saved",
    );
  }

  function mergeSummary(sources: AdminPack[], target: AdminPack) {
    const moving = sources.filter((s) => s.id !== target.id);
    const count = moving.reduce((n, s) => n + packTotal(s), 0);
    const names = moving.map((s) => `"${s.name}"`).join(", ");
    const pronoun = moving.length === 1 ? "it" : "them";
    return (
      `"${target.name}" keeps its name, description and default status. ` +
      `${plural(count, "card")} move from ${names}. ` +
      `A game in progress that selected ${pronoun} stops drawing from ${pronoun} until the lobby restarts.`
    );
  }

  const mergePacks = (sources: AdminPack[], target: AdminPack) =>
    run(
      "Merge failed",
      () =>
        post("/api/admin/cards/merge-packs", {
          sourceIds: sources.filter((s) => s.id !== target.id).map((s) => s.id),
          targetId: target.id,
        }).then(() => undefined),
      `Merged into "${target.name}"`,
    );

  const setPacksActive = (packs: AdminPack[], active: boolean) =>
    run(
      "Could not update packs",
      async () => {
        for (const p of packs) {
          await post("/api/admin/cards/toggle-pack", { packId: p.id, type: "all", active });
        }
      },
      `${plural(packs.length, "pack")} ${active ? "enabled" : "disabled"}`,
    );

  const setPacksDefault = (packs: AdminPack[], isDefault: boolean) =>
    run("Could not update default packs", async () => {
      for (const p of packs.filter((p) => p.isDefault !== isDefault)) {
        await post("/api/admin/cards/toggle-default-pack", { packId: p.id, isDefault });
      }
    });

  const setPacksSeries = (packs: AdminPack[], series: string) =>
    run("Could not set the series", () =>
      post("/api/admin/cards/pack-meta-bulk", { packs: packs.map((p) => p.id), series }).then(
        () => undefined,
      ),
    );

  const setPacksFlag = (packs: AdminPack[], flag: "official" | "nsfw", value: boolean) =>
    run("Could not update packs", async () => {
      for (const p of packs.filter((p) => p[flag] !== value)) {
        await post("/api/admin/cards/pack-meta", { id: p.id, [flag]: value });
      }
    });

  async function deletePacks(packs: AdminPack[]) {
    const cards = packs.reduce((n, p) => n + packTotal(p), 0);
    const ok = await confirm({
      title: `Delete ${plural(packs.length, "pack")}`,
      message: `Permanently delete ${plural(packs.length, "pack")} and their ${plural(cards, "card")}? This cannot be undone.`,
      confirmButtonText: "Delete",
      confirmButtonColor: "error",
    });
    if (!ok) return false;
    return run(
      "Delete failed",
      async () => {
        for (const p of packs) {
          await post("/api/admin/cards/delete-pack", { packId: p.id, type: "all" });
        }
      },
      `${plural(packs.length, "pack")} deleted`,
    );
  }

  const moveCards = (cards: AdminCard[], dest: { packId: string } | { name: string }) =>
    run(
      "Move failed",
      async () => {
        const target = "packId" in dest ? { toPackId: dest.packId } : { toPack: dest.name };
        for (const [type, group] of byType(cards)) {
          for (const chunk of chunks(group, MOVE_CHUNK)) {
            await post("/api/admin/cards/move", { from: { ids: chunk.map((c) => c.id) }, type, ...target });
          }
        }
      },
      `${plural(cards.length, "card")} moved`,
    );

  const setCardsActive = (cards: AdminCard[], active: boolean) =>
    run(
      "Could not update cards",
      async () => {
        for (const [type, group] of byType(cards.filter((c) => c.active !== active))) {
          await post("/api/admin/cards/set-active", { ids: group.map((c) => c.id), type, active });
        }
      },
      `${plural(cards.length, "card")} ${active ? "enabled" : "disabled"}`,
    );

  const setCardsPick = (cards: AdminCard[], pick: number) =>
    run("Could not set pick", async () => {
      const ids = cards.filter((c) => c.type === "black" && (c.pick ?? 1) !== pick).map((c) => c.id);
      for (const chunk of chunks(ids, PICK_CHUNK)) {
        await post("/api/admin/cards/set-pick", { ids: chunk, pick });
      }
    });

  const saveCard = (card: AdminCard, edit: { text: string; pick?: number }) =>
    run(
      "Could not save the card",
      () =>
        post("/api/admin/cards/edit", {
          id: card.id,
          type: card.type,
          text: edit.text,
          pick: edit.pick,
          imageFileId: card.imageKey ?? undefined,
          imageFormat: card.imageFormat ?? undefined,
          attachment: card.attachment ?? undefined,
        }).then(() => undefined),
      "Card saved",
    );

  async function deleteCards(cards: AdminCard[]) {
    const ok = await confirm({
      title: `Delete ${plural(cards.length, "card")}`,
      message: `Permanently delete ${plural(cards.length, "card")}? This cannot be undone.`,
      confirmButtonText: "Delete",
      confirmButtonColor: "error",
    });
    if (!ok) return false;

    busy.value = true;
    let deleted = 0;
    let failedInARow = 0;
    try {
      for (const c of cards) {
        try {
          await post("/api/admin/cards/delete", { id: c.id, type: c.type });
          deleted++;
          failedInARow = 0;
        } catch {
          if (++failedInARow >= 5) break;
        }
      }
    } finally {
      busy.value = false;
    }
    const all = deleted === cards.length;
    notify({
      title: all ? "Cards deleted" : "Delete incomplete",
      description: `Deleted ${deleted} of ${plural(cards.length, "card")}.`,
      color: all ? "success" : "error",
    });
    return all;
  }

  return {
    busy,
    packToDraft,
    savePack,
    mergeSummary,
    mergePacks,
    setPacksActive,
    setPacksDefault,
    setPacksSeries,
    setPacksFlag,
    deletePacks,
    moveCards,
    setCardsActive,
    setCardsPick,
    saveCard,
    deleteCards,
  };
}

export type ExplorerMutations = ReturnType<typeof useExplorerMutations>;
