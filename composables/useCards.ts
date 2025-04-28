import { Query } from 'appwrite'
import { getAppwrite } from '~/utils/appwrite';

export const useCards = () => {

  const fetchRandomWhiteCard = async () => {
    if (import.meta.server) return null;

    try {
      const config = useRuntimeConfig();
      const { databases } = getAppwrite();

      // Step 1: Get total number of white cards
      const totalRes = await databases.listDocuments(
          config.public.appwriteDatabaseId,
          config.public.appwriteWhiteCardCollectionId,
          [Query.limit(1)]
      );

      const total = totalRes.total;
      if (total === 0) return null;

      // Step 2: Random offset
      const offset = Math.floor(Math.random() * total);

      console.log("Fetching white card at offset:", offset);

      // Step 3: Fetch one random card
      const res = await databases.listDocuments(
          config.public.appwriteDatabaseId,
          config.public.appwriteWhiteCardCollectionId,
          [Query.offset(offset), Query.limit(1)]
      );

      return res.documents[0] ?? null;
    } catch (err) {
      console.error("Failed to fetch white card:", err);
      return null;
    }
  };

  const fetchRandomBlackCard = async (pick: number = 1) => {
    if (import.meta.server) return null;
    try {
      const config = useRuntimeConfig();
      const { databases } = getAppwrite();

      // Define the query filter based on the 'pick' attribute
      const pickFilter = Query.equal('pick', pick);

      // Step 1: Get total number of black cards *matching the pick value*
      const totalRes = await databases.listDocuments(
          config.public.appwriteDatabaseId,
          config.public.appwriteBlackCardCollectionId,
          [
            pickFilter, // Add the filter here
            Query.limit(1) // We only need the total count
          ]
      );

      const total = totalRes.total;
      if (total === 0) {
        console.warn(`No black cards found with pick=${pick}`);
        return null; // No cards found with this pick value
      }

      // Step 2: Random offset *within the filtered results*
      const offset = Math.floor(Math.random() * total);

      console.log(`Fetching random black card with pick=${pick} at offset: ${offset} (out of ${total})`);

      // Step 3: Fetch one random card *matching the pick value*
      const res = await databases.listDocuments(
          config.public.appwriteDatabaseId,
          config.public.appwriteBlackCardCollectionId,
          [
            pickFilter, // Add the filter again
            Query.offset(offset),
            Query.limit(1)
          ]
      );

      return res.documents[0] ?? null;
    } catch (err: any) {
      // Check if the error is due to an invalid attribute or query
      if (err.message && err.message.includes('Attribute not found')) {
        const config = useRuntimeConfig();
        console.error(`Failed to fetch black card: Make sure the 'pick' attribute exists and is indexed in your Appwrite collection '${config.public.appwriteBlackCardCollectionId}'. Error: ${err}`);
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
