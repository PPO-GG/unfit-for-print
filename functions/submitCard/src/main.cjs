// src/main.cjs
const { Client, Databases } = require('node-appwrite');

module.exports = async ({ req, res, log, error }) => {
  const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  console.log('🔍 ENV:', {
    endpoint: process.env.APPWRITE_ENDPOINT,
    db: process.env.APPWRITE_DB_ID,
    collection: process.env.APPWRITE_LOBBY_COLLECTION,
  });
  try {
    const body = JSON.parse(req.body || '{}');
    const { lobbyId, userId, cardId } = body;

    if (!lobbyId || !userId || !cardId) {
      return res.send(JSON.stringify({ success: true }));
    }

    const doc = await databases.getDocument(
        process.env.APPWRITE_DB_ID,
        process.env.APPWRITE_LOBBY_COLLECTION,
        lobbyId
    );

    const gameState = JSON.parse(doc.gameState);
    gameState.playedCards = gameState.playedCards || {};
    gameState.playedCards[userId] = cardId;

    await databases.updateDocument(
        process.env.APPWRITE_DB_ID,
        process.env.APPWRITE_LOBBY_COLLECTION,
        lobbyId,
        {
          gameState: JSON.stringify(gameState),
        }
    );

    return res.json({ success: true });
  } catch (err) {
    error(err.message);
    return res.send(JSON.stringify({ success: false, error: err.message }));
  }
};
