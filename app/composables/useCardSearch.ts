// composables/useCardSearch.ts
import { ref } from 'vue'

/**
 * Composable for sharing card search state between components
 */
export function useCardSearch() {
  // Shared state
  const searchTerm = ref('')
  const cardType = ref<'white' | 'black'>('black')
  const activeTab = ref('cards')

  // Set search parameters and navigate to card manager
  const setSearchParams = (term: string, type: 'white' | 'black') => {
    searchTerm.value = term
    cardType.value = type
    activeTab.value = 'cards'
  }

  return {
    searchTerm,
    cardType,
    activeTab,
    setSearchParams
  }
}
