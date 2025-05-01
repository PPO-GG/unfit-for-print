//playCard/src/main.js
import { Client, Databases, Query } from 'node-appwrite';

// Utility functions for encoding/decoding game state
const encodeGameState = (state) => {
  try {
    return JSON.stringify(state);
  } catch (error) {
    console.error('Failed to encode game state:', error);
    return '';
  }
};

const decodeGameState = (raw) => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Failed to decode game state:', error);
    return {};
  }
};

export default async function ({ req, res, log, error }) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const databases = new Databases(client);
  const DB = process.env.APPWRITE_DATABASE_ID;
  const LOBBY_COLLECTION = process.env.LOBBY_COLLECTION;
  const GAMECARDS_COLLECTION = process.env.GAMECARDS_COLLECTION;

  try {
    const raw = req.body ?? req.payload ?? '';
    log('Raw body:', raw);

    if (!raw) {
      throw new Error('Request body is empty');
    }

    // Parse JSON if needed
    let payload = raw;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        throw new Error(`Failed to parse JSON body: ${e.message}`);
      }
    }

    // Extract data from the payload
    const { lobbyId, playerId, cardIds } = payload;

    // Check if required fields are present
    if (!lobbyId) throw new Error('lobbyId is required');
    if (!playerId) throw new Error('playerId is required');
    if (!cardIds || !Array.isArray(cardIds))
      throw new Error('cardIds must be an array');

    const lobby = await databases.getDocument(DB, LOBBY_COLLECTION, lobbyId);
    const state = decodeGameState(lobby.gameState);

    // Fetch the gamecards document
    const gameCardsQuery = await databases.listDocuments(
      DB,
      GAMECARDS_COLLECTION,
      [Query.equal('lobbyId', lobbyId)]
    );

    if (gameCardsQuery.documents.length === 0) {
      throw new Error(`No gamecards document found for lobby ${lobbyId}`);
    }

    const gameCards = gameCardsQuery.documents[0];

    // Use player hands from gameCards
    // Convert playerHands array to hands object
    state.hands = {};
    gameCards.playerHands.forEach((handString) => {
      const hand = JSON.parse(handString);
      state.hands[hand.playerId] = hand.cards;
    });

    if (state.phase !== 'submitting')
      throw new Error('Not accepting submissions');
    if (state.judgeId === playerId) throw new Error('Czar cannot play');
    if (state.submissions[playerId]) throw new Error('Already submitted');

    // Remove cards from hand
    cardIds.forEach((id) => {
      const idx = state.hands[playerId].indexOf(id);
      if (idx < 0) throw new Error('Card not in hand');
      state.hands[playerId].splice(idx, 1);
    });

    // Record submission
    state.submissions[playerId] = cardIds;

    // Also update playedCards for client-side compatibility
    state.playedCards = state.playedCards || {};
    state.playedCards[playerId] = cardIds;

    // Check if all players have submitted
    const toPlay = Object.keys(state.hands).filter(
      (id) => id !== state.judgeId
    );
    if (Object.keys(state.submissions).length === toPlay.length) {
      state.phase = 'judging';
    }

    // Extract updated player hands for gameCards document
    // Convert hands object back to playerHands array
    const handsArray = Object.entries(state.hands).map(([playerId, cards]) =>
      JSON.stringify({ playerId, cards })
    );

    // Only include the fields we need, excluding metadata fields like $databaseId
    const updatedGameCards = {
      lobbyId: gameCards.lobbyId,
      whiteDeck: gameCards.whiteDeck,
      blackDeck: gameCards.blackDeck,
      discardWhite: gameCards.discardWhite,
      discardBlack: gameCards.discardBlack,
      playerHands: handsArray,
    };

    // Create a clean state object without hands data
    const coreState = {
        phase: state.phase,
        judgeId: state.judgeId,
        blackCard: state.blackCard,
        submissions: state.submissions || {},
        playedCards: state.playedCards || {},
        scores: state.scores || {},
        round: state.round,
        roundWinner: state.roundWinner,
        roundEndStartTime: state.roundEndStartTime,
        returnedToLobby: state.returnedToLobby,
        gameEndTime: state.gameEndTime
    };

    // Update both documents
    await databases.updateDocument(
      DB,
      GAMECARDS_COLLECTION,
      gameCards.$id,
      updatedGameCards
    );

    await databases.updateDocument(DB, LOBBY_COLLECTION, lobbyId, {
      gameState: encodeGameState(coreState),
    });

    return res.json({ success: true });
  } catch (err) {
    error('playCard error: ' + err.message);
    return res.json({ success: false, error: err.message });
  }
}
