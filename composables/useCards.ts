import { Query } from 'appwrite'
export const useCards = () => {
  const getAppwrite = () => {
    if (import.meta.server) throw new Error("useLobby() cannot be used during SSR");
    const { databases, account, client } = useAppwrite();
    if (!databases || !account) throw new Error("Appwrite not initialized");
    return { databases, account, client };
  };

  const fetchRandomWhiteCard = async () => {
    if (import.meta.server) return null;
    try {
      const config = useRuntimeConfig();
      const { databases } = getAppwrite();
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
