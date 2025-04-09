// composables/usePlayers.ts
import { Query } from 'appwrite'
import { useAppwrite } from '~/composables/useAppwrite'

export const usePlayers = () => {
  const getConfig = () => useRuntimeConfig();
  const getPlayersForLobby = async (lobbyId: string) => {
    let databases;
    try {
      const config = getConfig();
      databases = useAppwrite().databases;
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
