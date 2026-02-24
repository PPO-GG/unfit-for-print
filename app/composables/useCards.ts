import { Query } from 'appwrite'
import { getAppwrite } from '~/utils/appwrite';
import { useCardTotalsStore } from '~/stores/cardTotalsStore';
import { getRandomInt } from '~/composables/useCrypto';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useCards = () => {

  const totalsStore = useCardTotalsStore()

  /**
   * Fetches a random card of the specified type
   * @param type The type of card to fetch ('white' or 'black')
   * @param pick The number of cards to pick (only used for black cards, defaults to 1)
   * @param cardPacks Optional array of card packs to filter by
   * @returns A promise that resolves to the fetched card or null
   */
  const fetchRandomCard = async (type: 'white' | 'black', pick: number = 1, cardPacks?: string[]) => {
    if (import.meta.server) return null;

    try {
      const config = useRuntimeConfig();
      const { databases, tables } = getAppwrite();
      const collectionId = type === 'white'
          ? config.public.appwriteWhiteCardCollectionId as string
          : config.public.appwriteBlackCardCollectionId as string;
      const packKey = cardPacks && cardPacks.length > 0
          ? [...cardPacks].sort().join('|')
          : 'ALL';

      let queries: any[] = [Query.limit(1)];

      if (type === 'black') {
        queries.push(Query.equal('pick', pick));
      }
      if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
        const packConditions = cardPacks.map(pack => Query.equal('pack', pack));
        queries.push(packConditions.length > 1 ? Query.or(packConditions) : packConditions[0]);
      }

      let cached = type === 'white'
          ? totalsStore.getWhiteTotal(packKey)
          : totalsStore.getBlackTotal(packKey, pick);

      // Bypass caching for black cards; white cards still use cache.
      if ((type === 'white' && (!cached || Date.now() - cached.lastFetched > CACHE_TTL)) ||
          type === 'black') {
        const totalRes = await tables.listRows({ databaseId: config.public.appwriteDatabaseId as string, tableId: collectionId, queries: queries });
        if (type === 'white') {
          totalsStore.setWhiteTotal(packKey, totalRes.total);
          cached = totalsStore.getWhiteTotal(packKey);
        } else {
          totalsStore.setBlackTotal(packKey, pick, totalRes.total);
          cached = totalsStore.getBlackTotal(packKey, pick);
        }
      }

      const total = cached?.total ?? 0;
      if (total === 0) return null;

      const offset = getRandomInt(total);
      queries = [Query.offset(offset), Query.limit(1)];
      if (type === 'black') {
        queries.push(Query.equal('pick', pick));
      }
      if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
        const packConditions = cardPacks.map(pack => Query.equal('pack', pack));
        queries.push(packConditions.length > 1 ? Query.or(packConditions) : packConditions[0]);
      }

      const res = await tables.listRows({ databaseId: config.public.appwriteDatabaseId as string, tableId: collectionId, queries: queries });

      return res.rows[0] ?? null;
    } catch (err: any) {
      if (type === 'black' && err.message && err.message.includes('Attribute not found')) {
        console.error(`Failed to fetch black card: Make sure the 'pick' attribute exists. Error: ${err}`);
      } else {
        console.error(`Failed to fetch ${type} card:`, err);
      }
      return null;
    }
  };

  // Keep the original functions for backward compatibility
  const fetchRandomWhiteCard = async (cardPacks?: string[]) => {
    return fetchRandomCard('white', 1, cardPacks);
  };

  const fetchRandomBlackCard = async (pick: number = 1, cardPacks?: string[]) => {
    return fetchRandomCard('black', pick, cardPacks);
  };

  return {
    fetchRandomCard,
    fetchRandomWhiteCard,
    fetchRandomBlackCard,
  };
};
