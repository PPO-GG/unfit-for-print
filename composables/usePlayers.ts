// composables/usePlayers.ts
import { Query } from 'appwrite'
import { getAppwrite } from '~/utils/appwrite';

export const usePlayers = () => {
  const getConfig = () => useRuntimeConfig();
  const getPlayersForLobby = async (lobbyId: string) => {
    let databases;
    try {
      const config = getConfig();
      const databases = getAppwrite().databases;
      const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        'players',
        [Query.equal('lobbyId', lobbyId)]
      )
      return res.documents
    } catch (err) {
      console.error('Failed to fetch players for lobby:', err)
      return []
    }
  }

  return {
    getPlayersForLobby
  }
}
