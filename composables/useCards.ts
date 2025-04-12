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

  const fetchRandomBlackCard = async () => {
    if (import.meta.server) return null;
    try {
      const config = useRuntimeConfig();
      const { databases } = getAppwrite();
      // First, get total count
      const countRes = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        config.public.appwriteBlackCardCollectionId,
        [Query.limit(1)]
      );

      const total = countRes.total;
      if (total === 0) return null;

      // Then, use a valid random offset
      const offset = Math.floor(Math.random() * total);
      const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        config.public.appwriteBlackCardCollectionId,
        [Query.limit(1), Query.offset(offset)]
      );

      return res.documents[0] ?? null;
    } catch (err) {
      console.error("Failed to fetch black card:", err);
      return null;
    }
  };

  return {
    fetchRandomWhiteCard,
    fetchRandomBlackCard,
  };
};
