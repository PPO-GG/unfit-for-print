// composables/useCardSearch.ts
import { ref } from "vue";

/**
 * Module-level singleton state so card search persists across route navigation.
 */
const searchTerm = ref("");
const cardType = ref<"white" | "black">("black");
const activeTab = ref("cards");
const selectedPack = ref<string | undefined>(undefined);

/**
 * Composable for sharing card search state between components and pages.
 */
export function useCardSearch() {
  const setSearchParams = (
    term: string,
    type: "white" | "black",
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
