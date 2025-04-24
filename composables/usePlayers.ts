// composables/usePlayers.ts
import { Query } from 'appwrite';
import { getAppwrite } from '~/utils/appwrite';
import type { Player } from '~/types/player';

export const usePlayers = () => {
  const getConfig = () => useRuntimeConfig();

  const getPlayersForLobby = async (lobbyId: string): Promise<Player[]> => {
    try {
      const { databases } = getAppwrite();
      const config = getConfig();
      const res = await databases.listDocuments(
          config.public.appwriteDatabaseId,
          config.public.appwritePlayerCollectionId,
          [Query.equal('lobbyId', lobbyId)]
      );

      return res.documents.map((doc) => ({
        $id: doc.$id,
        userId: doc.userId,
        lobbyId: doc.lobbyId,
        name: doc.name,
        avatar: doc.avatar,
        isHost: doc.isHost,
        joinedAt: doc.joinedAt,
        provider: doc.provider,
      })) satisfies Player[];
    } catch (err) {
      console.error('Failed to fetch players for lobby:', err);
      return [];
    }
  };

  return {
    getPlayersForLobby,
  };
};
