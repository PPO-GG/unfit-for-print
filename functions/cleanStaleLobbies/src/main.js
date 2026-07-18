// cleanStaleLobbies/src/main.js
import { Client, Databases, Query } from 'node-appwrite'

export default async function ({ req, res, log, error }) {
  const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

  const databases = new Databases(client)
  const DB = process.env.APPWRITE_DATABASE_ID || '682f6e7600320fde48dd'
  const LOBBY_COLLECTION = process.env.LOBBY_COLLECTION || '682f739000399dcb3559'
  const PLAYER_COLLECTION = process.env.PLAYER_COLLECTION || '682f74c3002e6e839dcf'
  const GAMECARDS_COLLECTION = process.env.GAMECARDS_COLLECTION || '682f70a2003d1627f79e'
  const GAMECHAT_COLLECTION = process.env.GAMECHAT_COLLECTION || '682f71970037cff8ed48'

  const PAGE_SIZE = 100

  try {
    log('Starting stale lobby cleanup process');

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const staleTimestamp = oneHourAgo.toISOString();

    log('Looking for lobbies inactive since:', staleTimestamp);

    // Fetch all stale lobbies with pagination
    let staleLobbies = []
    let cursor = null

    while (true) {
      const queryParams = [
        Query.lessThan('$updatedAt', staleTimestamp),
        Query.limit(PAGE_SIZE),
      ]
      if (cursor) queryParams.push(Query.cursorAfter(cursor))

      const page = await databases.listDocuments(DB, LOBBY_COLLECTION, queryParams)
      staleLobbies = staleLobbies.concat(page.documents)

      if (page.documents.length < PAGE_SIZE) break
      cursor = page.documents[page.documents.length - 1].$id
    }

    log(`Found ${staleLobbies.length} stale lobbies to clean up`);

    let deletedLobbiesCount = 0;
    let deletedPlayersCount = 0;
    let deletedGamecardsCount = 0;
    let deletedChatsCount = 0;

    for (const lobby of staleLobbies) {
      try {
        const [players, gamecards, chats] = await Promise.all([
          databases.listDocuments(DB, PLAYER_COLLECTION, [Query.equal('lobbyId', lobby.$id), Query.limit(200)]),
          databases.listDocuments(DB, GAMECARDS_COLLECTION, [Query.equal('lobbyId', lobby.$id), Query.limit(200)]),
          databases.listDocuments(DB, GAMECHAT_COLLECTION, [Query.equal('lobbyId', lobby.$id), Query.limit(500)]),
        ])

        await Promise.all([
          ...players.documents.map(p => databases.deleteDocument(DB, PLAYER_COLLECTION, p.$id)),
          ...gamecards.documents.map(g => databases.deleteDocument(DB, GAMECARDS_COLLECTION, g.$id)),
          ...chats.documents.map(c => databases.deleteDocument(DB, GAMECHAT_COLLECTION, c.$id)),
        ])

        deletedPlayersCount += players.documents.length
        deletedGamecardsCount += gamecards.documents.length
        deletedChatsCount += chats.documents.length

        await databases.deleteDocument(DB, LOBBY_COLLECTION, lobby.$id)
        deletedLobbiesCount++

        log(`Deleted lobby ${lobby.$id} (${lobby.code ?? 'unknown'})`)
      } catch (err) {
        error(`Failed to delete lobby ${lobby.$id}: ${err.message}`)
      }
    }

    log(`Cleanup complete. Deleted ${deletedLobbiesCount} lobbies, ${deletedPlayersCount} players, ${deletedGamecardsCount} gamecards, ${deletedChatsCount} chats.`);

    return res.json({
      success: true,
      staleLobbiesDeleted: deletedLobbiesCount,
      playersDeleted: deletedPlayersCount,
      gamecardsDeleted: deletedGamecardsCount,
      chatsDeleted: deletedChatsCount,
    });
  } catch (err) {
    error('cleanStaleLobbies error: ' + err.message);
    return res.json({ success: false, error: err.message });
  }
}
