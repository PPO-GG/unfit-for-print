import { Query } from 'appwrite'
export const useCards = () => {
  const { databases } = useAppwrite()
  const config = useRuntimeConfig();

  const fetchRandomWhiteCard = async () => {
    try {
      // First, get total count
      const countRes = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        config.public.appwriteWhiteCardCollectionId,
        [Query.limit(1)]
      );

      const total = countRes.total;
      if (total === 0) return null;

      // Then, use a valid random offset
      const offset = Math.floor(Math.random() * total);
      const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        config.public.appwriteWhiteCardCollectionId,
        [Query.limit(1), Query.offset(offset)]
      );

      return res.documents[0] ?? null;
    } catch (err) {
      console.error("Failed to fetch white card:", err);
      return null;
    }
  };

  const fetchRandomBlackCard = async () => {
    try {
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
