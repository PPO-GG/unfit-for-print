import { defineStore } from 'pinia'

interface CachedTotal {
  total: number
  lastFetched: number
}

export const useCardTotalsStore = defineStore('cardTotals', {
  state: () => ({
    whiteTotals: {} as Record<string, CachedTotal>,
    blackTotals: {} as Record<string, Record<number, CachedTotal>>,
  }),
  actions: {
    setWhiteTotal(packKey: string, total: number) {
      this.whiteTotals[packKey] = { total, lastFetched: Date.now() }
    },
    setBlackTotal(packKey: string, pick: number, total: number) {
      if (!this.blackTotals[packKey]) {
        this.blackTotals[packKey] = {}
      }
      this.blackTotals[packKey][pick] = { total, lastFetched: Date.now() }
    },
    getWhiteTotal(packKey: string): CachedTotal | undefined {
      return this.whiteTotals[packKey]
    },
    getBlackTotal(packKey: string, pick: number): CachedTotal | undefined {
      return this.blackTotals[packKey]?.[pick]
    }
  }
})
