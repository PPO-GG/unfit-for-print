// cleanStaleLobbies/src/main.js
import { Client, Databases, Query } from 'node-appwrite'

export default async function ({ req, res, log, error }) {
  // Initialize Appwrite SDK
  const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

  const databases = new Databases(client)
  const DB = process.env.APPWRITE_DATABASE_ID
  const LOBBY_COLLECTION = process.env.LOBBY_COLLECTION
  const PLAYER_COLLECTION = process.env.PLAYER_COLLECTION
  const GAMECARDS_COLLECTION = process.env.GAMECARDS_COLLECTION
  const GAMECHAT_COLLECTION = process.env.GAMECHAT_COLLECTION

  try {
    log('Starting stale lobby cleanup process');

    // Calculate the timestamp for 1 hour ago
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const staleTimestamp = oneHourAgo.toISOString();

    log('Looking for lobbies inactive since:', staleTimestamp);

    // Query for all lobbies
    const lobbies = await databases.listDocuments(DB, LOBBY_COLLECTION);

    let staleLobbiesCount = 0;
    let deletedPlayersCount = 0;
    let deletedGamecardsCount = 0;
    let deletedChatsCount = 0;

    // Process each lobby
    for (const lobby of lobbies.documents) {
      // Check if the lobby has a lastActivity field
      // If not, we'll use the $updatedAt field from Appwrite
      const lastActivityTime = lobby.lastActivity || lobby.$updatedAt;

      // Check if the lobby is stale (no activity for more than an hour)
      if (lastActivityTime < staleTimestamp) {
        log(`Found stale lobby: ${lobby.$id}, last active: ${lastActivityTime}`);
        staleLobbiesCount++;

        // Find all players in this lobby
        const players = await databases.listDocuments(DB, PLAYER_COLLECTION, [
          Query.equal('lobbyId', lobby.$id)
        ]);

        // Delete all player documents for this lobby
        for (const player of players.documents) {
          await databases.deleteDocument(DB, PLAYER_COLLECTION, player.$id);
          deletedPlayersCount++;
        }

        log(`Deleted ${players.documents.length} player documents for lobby ${lobby.$id}`);

        // Find and delete gamecards document for this lobby
        const gamecards = await databases.listDocuments(DB, GAMECARDS_COLLECTION, [
          Query.equal('lobbyId', lobby.$id)
        ]);

        let lobbyGamecardsCount = 0;
        for (const gamecard of gamecards.documents) {
          await databases.deleteDocument(DB, GAMECARDS_COLLECTION, gamecard.$id);
          lobbyGamecardsCount++;
          deletedGamecardsCount++;
        }

        log(`Deleted ${lobbyGamecardsCount} gamecards documents for lobby ${lobby.$id}`);

        // Find and delete chat documents for this lobby
        const chats = await databases.listDocuments(DB, GAMECHAT_COLLECTION, [
          Query.equal('lobbyId', lobby.$id)
        ]);

        let lobbyChatsCount = 0;
        for (const chat of chats.documents) {
          await databases.deleteDocument(DB, GAMECHAT_COLLECTION, chat.$id);
          lobbyChatsCount++;
          deletedChatsCount++;
        }

        log(`Deleted ${lobbyChatsCount} chat documents for lobby ${lobby.$id}`);

        // Delete the lobby document
        await databases.deleteDocument(DB, LOBBY_COLLECTION, lobby.$id);
        log(`Deleted stale lobby: ${lobby.$id}`);
      }
    }

    log(`Cleanup complete. Deleted ${staleLobbiesCount} stale lobbies, ${deletedPlayersCount} player documents, and ${deletedGamecardsCount} gamecards documents.`);

    return res.json({
      success: true,
      staleLobbiesDeleted: staleLobbiesCount,
      playersDeleted: deletedPlayersCount,
      gamecardsDeleted: deletedGamecardsCount,
      chatsDeleted: deletedChatsCount
    });
  } catch (err) {
    error('cleanStaleLobbies error: ' + err.message);
    return res.json({ success: false, error: err.message });
  }
}
