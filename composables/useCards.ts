import { Query } from 'appwrite'
import { getAppwrite } from '~/utils/appwrite';

export const useCards = () => {

  const fetchRandomWhiteCard = async (cardPacks?: string[]) => {
    if (import.meta.server) return null;

    try {
      const config = useRuntimeConfig();
      const { databases } = getAppwrite();

      // Create queries array
      let queries = [Query.limit(1)];

      // Add filter for card packs if specified
      if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
        // Create an array of pack conditions
        const packConditions = cardPacks.map(pack => Query.equal('pack', pack));

        // If we have multiple packs, use Query.or to combine them
        if (packConditions.length > 1) {
          queries.push(Query.or(packConditions));
        } else if (packConditions.length === 1) {
          // If we only have one pack, just add it directly
          queries.push(packConditions[0]);
        }
      }

      // Step 1: Get total number of white cards (filtered by card packs if specified)
      const totalRes = await databases.listDocuments(
          config.public.appwriteDatabaseId as string,
          config.public.appwriteWhiteCardCollectionId as string,
          queries
      );

      const total = totalRes.total;
      if (total === 0) return null;

      // Step 2: Random offset
      const offset = Math.floor(Math.random() * total);

      // console.log(`Fetching random white card at offset: `, offset,` (out of `,total,`)`, cardPacks ? ` from packs: ${cardPacks.join(', ')}` : '');

      // Step 3: Fetch one random card (filtered by card packs if specified)
      queries = [Query.offset(offset), Query.limit(1)];

      // Add filter for card packs if specified
      if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
        // Create an array of pack conditions
        const packConditions = cardPacks.map(pack => Query.equal('pack', pack));

        // If we have multiple packs, use Query.or to combine them
        if (packConditions.length > 1) {
          queries.push(Query.or(packConditions));
        } else if (packConditions.length === 1) {
          // If we only have one pack, just add it directly
          queries.push(packConditions[0]);
        }
      }

      const res = await databases.listDocuments(
          config.public.appwriteDatabaseId as string,
          config.public.appwriteWhiteCardCollectionId as string,
          queries
      );

      return res.documents[0] ?? null;
    } catch (err) {
      console.error("Failed to fetch white card:", err);
      return null;
    }
  };

  const fetchRandomBlackCard = async (pick: number = 1, cardPacks?: string[]) => {
    if (import.meta.server) return null;
    try {
      const config = useRuntimeConfig();
      const { databases } = getAppwrite();

      // Define the query filter based on the 'pick' attribute
      const pickFilter = Query.equal('pick', pick);

      // Create queries array with the pick filter
      let queries = [
        pickFilter,
        Query.limit(1) // We only need the total count
      ];

      // Add filter for card packs if specified
      if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
        // Create an array of pack conditions
        const packConditions = cardPacks.map(pack => Query.equal('pack', pack));

        // If we have multiple packs, use Query.or to combine them
        if (packConditions.length > 1) {
          queries.push(Query.or(packConditions));
        } else if (packConditions.length === 1) {
          // If we only have one pack, just add it directly
          queries.push(packConditions[0]);
        }
      }

      // Step 1: Get total number of black cards *matching the pick value and card packs if specified*
      const totalRes = await databases.listDocuments(
          config.public.appwriteDatabaseId as string,
          config.public.appwriteBlackCardCollectionId as string,
          queries
      );

      const total = totalRes.total;
      if (total === 0) {
        // console.warn(`No black cards found with pick=${pick}${cardPacks ? ` and specified card packs` : ''}`);
        return null; // No cards found with this pick value and card packs
      }

      // Step 2: Random offset *within the filtered results*
      const offset = Math.floor(Math.random() * total);

      // console.log(`Fetching random black card with pick=${pick} at offset: ${offset} (out of ${total})${cardPacks ? ` from packs: ${cardPacks.join(', ')}` : ''}`);

      // Step 3: Fetch one random card *matching the pick value and card packs if specified*
      queries = [
        pickFilter,
        Query.offset(offset),
        Query.limit(1)
      ];

      // Add filter for card packs if specified
      if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
        // Create an array of pack conditions
        const packConditions = cardPacks.map(pack => Query.equal('pack', pack));

        // If we have multiple packs, use Query.or to combine them
        if (packConditions.length > 1) {
          queries.push(Query.or(packConditions));
        } else if (packConditions.length === 1) {
          // If we only have one pack, just add it directly
          queries.push(packConditions[0]);
        }
      }

      const res = await databases.listDocuments(
          config.public.appwriteDatabaseId as string,
          config.public.appwriteBlackCardCollectionId as string,
          queries
      );

      return res.documents[0] ?? null;
    } catch (err: any) {
      // Check if the error is due to an invalid attribute or query
      if (err.message && err.message.includes('Attribute not found')) {
        const config = useRuntimeConfig();
        console.error(`Failed to fetch black card: Make sure the 'pick' attribute exists'. Error: ${err}`);
      } else {
        console.error("Failed to fetch black card:", err);
      }
      return null;
    }
  };

  return {
    fetchRandomWhiteCard,
    fetchRandomBlackCard,
  };
};
