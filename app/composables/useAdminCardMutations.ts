/**
 * Every write the admin card manager performs — single cards and whole packs.
 *
 * Each operation is the same three beats: call the route, adjust the loaded
 * card list, adjust the pack-stat mirror. Keeping them together is what makes
 * the second and third beats consistent; they used to be open-coded per call
 * site, which is how the sidebar counts could drift out of step with the grid.
 *
 * Operations that can't be undone (`deletePack*`, `bulkDeletePacks`) confirm
 * first and report the card count they are about to destroy.
 */
import { ref } from "vue";
import { useCardSearch } from "~/composables/useCardSearch";
import { useNotifications } from "~/composables/useNotifications";
import { useConfirm } from "~/composables/useConfirm";
import type { AdminCard, AdminCardList } from "~/composables/useAdminCardList";
import type { AdminPackStats, AdminCardType } from "~/composables/useAdminPackStats";

export interface AdminCardMutationsOptions {
  list: AdminCardList;
  packs: AdminPackStats;
}

export function useAdminCardMutations({
  list,
  packs,
}: AdminCardMutationsOptions) {
  const { $activityFetch } = useNuxtApp();
  const { notify } = useNotifications();
  const { confirm } = useConfirm();
  const { cardType, selectedPack } = useCardSearch();

  const bulkActionLoading = ref(false);

  function plural(n: number, word = "card") {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  /** Clear the grid if it is currently showing the pack that just went away. */
  function clearListIfShowing(packName: string, type?: AdminCardType) {
    if (selectedPack.value !== packName) return;
    if (type && cardType.value !== type) return;
    list.clearList();
  }

  // ── Single cards ─────────────────────────────────────────────────────────
  const toggleCardActive = async (card: AdminCard) => {
    try {
      const updated = await $activityFetch<{ active: boolean }>(
        "/api/admin/cards/toggle",
        { method: "POST", body: { id: card.id, type: cardType.value } },
      );
      card.active = updated.active;
      list.invalidateCache();
      packs.applyCardToggled(card.pack, cardType.value, updated.active);
    } catch {
      notify({
        title: "Update Failed",
        description: "Could not toggle card status.",
        color: "error",
      });
    }
  };

  const saveCardEdit = async (updateData: Record<string, unknown>) => {
    try {
      const updated = await $activityFetch<AdminCard>("/api/admin/cards/edit", {
        method: "POST",
        body: updateData,
      });
      list.applyCardUpdate(updated);
      notify({ title: "Card Updated", color: "success" });
      return true;
    } catch {
      notify({ title: "Update Failed", color: "error" });
      return false;
    }
  };

  const deleteCard = async (card: AdminCard) => {
    try {
      await $activityFetch("/api/admin/cards/delete", {
        method: "POST",
        body: { id: card.id, type: cardType.value },
      });
      list.removeCard(card.id);
      packs.applyCardDeleted(card.pack, cardType.value, !!card.active);
      notify({ title: "Card Deleted", color: "success" });
    } catch {
      notify({ title: "Delete Failed", color: "error" });
    }
  };

  const createCard = async (payload: Record<string, unknown>) => {
    list.loadingCards.value = true;
    try {
      const newCard = await $activityFetch<AdminCard>(
        "/api/admin/cards/create",
        { method: "POST", body: payload },
      );

      const type = payload.type as AdminCardType;
      list.invalidateCache();
      if (
        cardType.value === type &&
        (!selectedPack.value || selectedPack.value === payload.pack)
      ) {
        list.prependCard(newCard);
      }
      packs.applyCardCreated(payload.pack as string | undefined, type);

      notify({
        title: "Card Added",
        description: `Added to pack "${newCard.pack}"`,
        color: "success",
      });
      return true;
    } catch {
      notify({ title: "Add Failed", color: "error" });
      return false;
    } finally {
      list.loadingCards.value = false;
    }
  };

  // ── Whole packs ──────────────────────────────────────────────────────────
  /** Activate/deactivate a pack, scoped to whichever type is selected. */
  const togglePackActive = async (pack: string, setActive: boolean) => {
    if (!list.cards.value.some((c) => c.pack === pack)) return;

    list.loadingCards.value = true;
    try {
      await $activityFetch("/api/admin/cards/toggle-pack", {
        method: "POST",
        body: { pack, type: cardType.value, active: setActive },
      });
      list.setActiveForPack(pack, setActive);
      packs.applyPackToggled(pack, cardType.value, setActive);
      notify({
        title: `Pack ${setActive ? "Activated" : "Deactivated"}`,
        description: `All cards in "${pack}" have been ${setActive ? "activated" : "deactivated"}.`,
        color: "success",
      });
    } catch {
      notify({
        title: "Update Failed",
        description: "Could not toggle pack status.",
        color: "error",
      });
    } finally {
      list.loadingCards.value = false;
    }
  };

  /** The both-types counterpart to togglePackActive. */
  const togglePackActiveAll = async (pack: string, setActive: boolean) => {
    try {
      await $activityFetch("/api/admin/cards/toggle-pack", {
        method: "POST",
        body: { pack, type: "all", active: setActive },
      });
      list.invalidateCache();
      if (selectedPack.value === pack) list.setActiveForPack(pack, setActive);
      packs.applyPackToggled(pack, "all", setActive);
    } catch {
      notify({
        title: "Update Failed",
        description: `Could not update pack "${pack}".`,
        color: "error",
      });
    }
  };

  const deletePackAll = async (packName: string) => {
    const count = packs.cardCountFor(packName);
    const confirmed = await confirm({
      title: "Delete Pack",
      message: `Are you sure you want to permanently delete "${packName}" (${plural(count)})? This cannot be undone.`,
      confirmButtonText: "Delete Pack",
      confirmButtonColor: "error",
    });
    if (!confirmed) return;

    try {
      await $activityFetch("/api/admin/cards/delete-pack", {
        method: "POST",
        body: { pack: packName, type: "all" },
      });

      list.invalidateCache();
      packs.forgetPack(packName);
      if (selectedPack.value === packName) {
        selectedPack.value = undefined;
        list.clearList();
      }

      notify({
        title: "Pack Deleted",
        description: `Pack "${packName}" and its ${plural(count)} were deleted.`,
        color: "success",
      });
    } catch {
      notify({
        title: "Delete Failed",
        description: `Could not delete pack "${packName}".`,
        color: "error",
      });
    }
  };

  const deletePackType = async (packName: string, type: AdminCardType) => {
    const stat = packs.packStats.value[packName];
    const typeCount = stat ? stat[type].total : 0;
    const label = type === "black" ? "Black" : "White";
    const confirmed = await confirm({
      title: `Delete ${label} Cards`,
      message: `Are you sure you want to delete all ${typeCount} ${type} card${typeCount === 1 ? "" : "s"} in "${packName}"? This cannot be undone.`,
      confirmButtonText: "Delete Cards",
      confirmButtonColor: "error",
    });
    if (!confirmed) return;

    try {
      await $activityFetch("/api/admin/cards/delete-pack", {
        method: "POST",
        body: { pack: packName, type },
      });

      list.invalidateCache();
      packs.applyPackTypeCleared(packName, type);
      clearListIfShowing(packName, type);

      notify({
        title: `${label} Cards Deleted`,
        description: `Deleted ${typeCount} ${type} card${typeCount === 1 ? "" : "s"} in "${packName}".`,
        color: "success",
      });
    } catch {
      notify({
        title: "Delete Failed",
        description: `Could not delete ${type} cards in "${packName}".`,
        color: "error",
      });
    }
  };

  // ── Bulk pack actions ────────────────────────────────────────────────────
  const bulkTogglePacks = async (setActive: boolean) => {
    const targets = [...packs.selectedPacks.value];
    if (!targets.length) return;

    bulkActionLoading.value = true;
    try {
      await Promise.all(
        targets.map((pack) => togglePackActiveAll(pack, setActive)),
      );
      notify({
        title: `${plural(targets.length, "Pack")} ${setActive ? "Activated" : "Deactivated"}`,
        color: "success",
      });
    } finally {
      bulkActionLoading.value = false;
    }
  };

  const bulkDeletePacks = async () => {
    const targets = [...packs.selectedPacks.value];
    if (!targets.length) return;

    const totalCardsCount = targets.reduce(
      (sum, pack) => sum + packs.cardCountFor(pack),
      0,
    );

    const confirmed = await confirm({
      title: `Delete ${plural(targets.length, "Pack")}`,
      message: `Are you sure you want to delete ${targets.length} selected pack${targets.length === 1 ? "" : "s"} (${totalCardsCount} total cards)? This cannot be undone.`,
      confirmButtonText: `Delete ${plural(targets.length, "Pack")}`,
      confirmButtonColor: "error",
    });
    if (!confirmed) return;

    bulkActionLoading.value = true;
    try {
      await Promise.all(
        targets.map((pack) =>
          $activityFetch("/api/admin/cards/delete-pack", {
            method: "POST",
            body: { pack, type: "all" },
          }),
        ),
      );

      list.invalidateCache();
      for (const pack of targets) packs.forgetPack(pack);
      if (selectedPack.value && targets.includes(selectedPack.value)) {
        selectedPack.value = undefined;
        list.clearList();
      }
      packs.clearPackSelection();

      notify({
        title: `${plural(targets.length, "Pack")} Deleted`,
        description: `Deleted ${plural(targets.length, "pack")} (${totalCardsCount} cards).`,
        color: "success",
      });
    } catch {
      notify({
        title: "Delete Failed",
        description: "Could not delete selected packs.",
        color: "error",
      });
    } finally {
      bulkActionLoading.value = false;
    }
  };

  return {
    bulkActionLoading,
    toggleCardActive,
    saveCardEdit,
    deleteCard,
    createCard,
    togglePackActive,
    togglePackActiveAll,
    deletePackAll,
    deletePackType,
    bulkTogglePacks,
    bulkDeletePacks,
  };
}
