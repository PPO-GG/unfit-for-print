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

/** Mirrors the server's MAX_IDS cap in server/api/admin/cards/move.post.ts. */
const MOVE_CHUNK = 500;

/** What the move route reports it did with the pack's auxiliary rows. */
type PackMoveAux = "move" | "drop" | "leave" | null;

interface MoveResponse {
  moved: { white: number; black: number };
  aux: PackMoveAux;
}

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

  // ── Pack reorganisation ──────────────────────────────────────────────────
  // Rename, merge and move-these-cards are the same server call with a
  // different `from`. What differs here is the confirm copy and which stat
  // helper repairs the mirror afterwards.

  /** Move every currently-selected card into `toPack`. */
  const moveSelectedCards = async (toPack: string) => {
    const ids = [...list.selectedCardIds.value];
    const target = toPack.trim();
    if (!ids.length || !target) return false;

    // The server returns counts, not rows, so derive the active count here
    // while the loaded cards still say which of them were active.
    const selected = list.cards.value.filter((c: AdminCard) => ids.includes(c.id));
    const sourcePack = selectedPack.value;

    // The route caps a request at MOVE_CHUNK ids, and "select all N matching"
    // routinely selects more than that, so send the selection in slices.
    // Sequentially, not in parallel: a partial failure has to leave a
    // prefix that completed, not an arbitrary subset.
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += MOVE_CHUNK) {
      chunks.push(ids.slice(i, i + MOVE_CHUNK));
    }

    bulkActionLoading.value = true;
    const done = new Set<string>();
    let total = 0;
    try {
      for (const chunk of chunks) {
        const { moved } = await $activityFetch<MoveResponse>(
          "/api/admin/cards/move",
          {
            method: "POST",
            body: { from: { ids: chunk }, toPack: target, type: cardType.value },
          },
        );
        total += moved.white + moved.black;
        for (const id of chunk) done.add(id);
      }

      list.invalidateCache();
      mirrorMovedCards(selected, target);

      // A pack-filtered grid no longer matches cards moved to a different
      // pack, so drop them instead of leaving them mislabelled until the
      // next fetch. In search mode (no pack filter) there is nothing to
      // drop them from, so just relabel them in place.
      if (sourcePack && sourcePack !== target) {
        list.cards.value = list.cards.value.filter((c: AdminCard) => !ids.includes(c.id));
        list.totalCards.value = list.cards.value.length;
      } else {
        for (const card of selected) card.pack = target;
      }
      list.clearCardSelection();

      notify({
        title: "Cards Moved",
        description: `Moved ${plural(total)} to "${target}".`,
        color: "success",
      });
      return true;
    } catch {
      // Chunks that completed really did move, so mirror exactly those and
      // leave the rest selected — the admin can retry them as they stand.
      if (done.size > 0) {
        const movedCards = selected.filter((c: AdminCard) => done.has(c.id));
        list.invalidateCache();
        mirrorMovedCards(movedCards, target);

        if (sourcePack && sourcePack !== target) {
          list.cards.value = list.cards.value.filter(
            (c: AdminCard) => !done.has(c.id),
          );
          list.totalCards.value = list.cards.value.length;
        } else {
          for (const card of movedCards) card.pack = target;
        }
        list.selectedCardIds.value = ids.filter((id) => !done.has(id));
      }

      notify({
        title: "Move Failed",
        description:
          done.size > 0
            ? `Moved ${done.size} of ${ids.length} cards to "${target}" before a request failed.`
            : `Could not move the selected cards to "${target}".`,
        color: "error",
      });
      return false;
    } finally {
      bulkActionLoading.value = false;
    }
  };

  /**
   * Debit each source pack separately. In search mode (no pack filter) the
   * selection can span several source packs; crediting the target off a
   * single `selectedPack` (which is `undefined` there) would inflate the
   * sidebar until a refetch, since the real sources never got debited.
   */
  function mirrorMovedCards(cards: AdminCard[], target: string) {
    const groups = new Map<string | undefined, AdminCard[]>();
    for (const card of cards) {
      const group = groups.get(card.pack);
      if (group) group.push(card);
      else groups.set(card.pack, [card]);
    }
    for (const [groupPack, group] of groups) {
      const groupActive = group.filter((c) => c.active).length;
      packs.applyCardsMoved(groupPack, target, cardType.value, group.length, groupActive);
    }
  }

  /** The one line every rename and merge confirm has to carry. */
  const liveLobbyWarning = (n: number) =>
    n === 1
      ? "Any game in progress that has this pack selected will drop it until the lobby restarts."
      : "Any game in progress that has these packs selected will drop them until the lobby restarts.";

  /**
   * Does anything already live under this name? The server decides the real
   * rename-vs-merge question (it can see rows the mirror never loads), but the
   * confirm copy has to say which one the admin is about to get.
   */
  function packExists(name: string) {
    return Boolean(
      packs.packStats.value[name] ||
        packs.packMeta.value[name] ||
        packs.defaultPacks.value.includes(name),
    );
  }

  const renamePack = async (packName: string, newName: string) => {
    const target = newName.trim();
    if (!target || target === packName) return false;

    const targetExists = packExists(target);

    const confirmed = await confirm({
      title: targetExists ? "Merge Pack" : "Rename Pack",
      message: targetExists
        ? `Rename "${packName}" onto "${target}"? "${target}" already exists, so this merges ` +
          `"${packName}" into it — "${target}" keeps its own description and default status ` +
          `and "${packName}"'s are discarded. ${liveLobbyWarning(1)}`
        : `Rename "${packName}" to "${target}"? ${liveLobbyWarning(1)}`,
      confirmButtonText: targetExists ? "Merge Pack" : "Rename Pack",
      confirmButtonColor: "primary",
    });
    if (!confirmed) return false;

    bulkActionLoading.value = true;
    try {
      const { aux } = await $activityFetch<MoveResponse>("/api/admin/cards/move", {
        method: "POST",
        body: { from: { pack: packName }, toPack: target, type: "all" },
      });

      list.invalidateCache();
      for (const card of list.cards.value) {
        if (card.pack === packName) card.pack = target;
      }
      packs.applyWholePackMoved(packName, target, aux);
      if (selectedPack.value === packName) selectedPack.value = target;

      notify({
        title: targetExists ? "Pack Merged" : "Pack Renamed",
        description: targetExists
          ? `Merged "${packName}" into "${target}".`
          : `"${packName}" is now "${target}".`,
        color: "success",
      });
      return true;
    } catch {
      notify({
        title: "Rename Failed",
        description: `Could not rename "${packName}".`,
        color: "error",
      });
      return false;
    } finally {
      bulkActionLoading.value = false;
    }
  };

  const mergePacks = async (sourceNames: string[], targetName: string) => {
    const target = targetName.trim();
    const sources = sourceNames.filter((n) => n && n !== target);
    if (!target || !sources.length) return false;

    // Into a name nothing occupies yet, the first source is *renamed* into it
    // server-side and keeps its auxiliary rows; only the rest are merged. Say
    // so, or the "the target's settings win" line would be a lie.
    const targetExists = packExists(target);
    const rest = sources.slice(1);

    const confirmed = await confirm({
      title: `Merge ${plural(sources.length, "Pack")}`,
      message: targetExists
        ? `Merge ${sources.map((s) => `"${s}"`).join(", ")} into "${target}"? ` +
          `"${target}" keeps its own description and default status — the merged packs' settings are discarded. ` +
          liveLobbyWarning(sources.length)
        : `Merge ${sources.map((s) => `"${s}"`).join(", ")} into "${target}"? ` +
          `"${target}" does not exist yet, so "${sources[0]}" becomes "${target}" and keeps its own ` +
          `description and default status` +
          (rest.length
            ? `; then ${rest.map((s) => `"${s}"`).join(", ")} merge into it. `
            : `. `) +
          liveLobbyWarning(sources.length),
      confirmButtonText: "Merge Packs",
      confirmButtonColor: "primary",
    });
    if (!confirmed) return false;

    bulkActionLoading.value = true;
    // Sources that already completed their move server-side before a later
    // one failed. On a partial failure the mirror and cache need to reflect
    // these, or they keep describing packs that no longer hold their cards.
    const completed: { source: string; aux: PackMoveAux }[] = [];
    try {
      // Sequential, not Promise.all: each move re-reads whether the target
      // already has cards, and concurrent writes would race that check.
      for (const source of sources) {
        const { aux } = await $activityFetch<MoveResponse>("/api/admin/cards/move", {
          method: "POST",
          body: { from: { pack: source }, toPack: target, type: "all" },
        });
        completed.push({ source, aux });
      }

      list.invalidateCache();
      for (const card of list.cards.value) {
        if (card.pack && sources.includes(card.pack)) card.pack = target;
      }
      for (const { source, aux } of completed) {
        packs.applyWholePackMoved(source, target, aux);
      }
      packs.clearPackSelection();
      if (selectedPack.value && sources.includes(selectedPack.value)) {
        selectedPack.value = target;
      }

      notify({
        title: `${plural(sources.length, "Pack")} Merged`,
        description: `Merged ${plural(sources.length, "pack")} into "${target}".`,
        color: "success",
      });
      return true;
    } catch {
      // Unlike every other mutation here, a partial merge is a deliberate
      // exception to "never touch the mirror on failure": the sources that
      // did complete really did move server-side, so leaving the mirror
      // untouched would itself be the lie.
      if (completed.length > 0) {
        const done = completed.map((c) => c.source);
        list.invalidateCache();
        for (const card of list.cards.value) {
          if (card.pack && done.includes(card.pack)) card.pack = target;
        }
        for (const { source, aux } of completed) {
          packs.applyWholePackMoved(source, target, aux);
        }
      }

      notify({
        title: "Merge Failed",
        description:
          completed.length > 0
            ? `Merged ${completed.length} of ${plural(sources.length, "pack")} into "${target}" before a request failed.`
            : `Could not merge into "${target}".`,
        color: "error",
      });
      return false;
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
    moveSelectedCards,
    renamePack,
    mergePacks,
  };
}
