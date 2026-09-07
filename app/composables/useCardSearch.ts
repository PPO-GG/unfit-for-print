// composables/useCardSearch.ts
import { ref } from "vue";

/** A card's own type. Every AdminCard carries one after a fetch. */
export type AdminCardType = "white" | "black";
/** What the browser is filtered to. "all" merges both tables client-side. */
export type AdminCardFilter = "all" | AdminCardType;

/**
 * Module-level singleton state so card search persists across route navigation.
 */
const searchTerm = ref("");
const cardType = ref<AdminCardFilter>("black");
const activeTab = ref("cards");
const selectedPack = ref<string | undefined>(undefined);

/**
 * Composable for sharing card search state between components and pages.
 */
export function useCardSearch() {
  const setSearchParams = (
    term: string,
    type: AdminCardFilter,
    pack?: string,
  ) => {
    searchTerm.value = term;
    cardType.value = type;
    activeTab.value = "cards";
    if (pack !== undefined) selectedPack.value = pack;
  };

  return {
    searchTerm,
    cardType,
    activeTab,
    selectedPack,
    setSearchParams,
  };
}
