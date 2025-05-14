// selectWinner/src/main.js
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
    const { lobbyId, winnerId } = payload;

    // Check if required fields are present
    if (!lobbyId) throw new Error('lobbyId is required');
    if (!winnerId) throw new Error('winnerId is required');

    const lobby = await databases.getDocument(
      DB,
      LOBBY_COLLECTION,
      lobbyId
    );
    const state = decodeGameState(lobby.gameState);

    // Fetch the gamecards document
    const gameCardsQuery = await databases.listDocuments(DB, GAMECARDS_COLLECTION, [
      Query.equal('lobbyId', lobbyId)
    ]);

    if (gameCardsQuery.documents.length === 0) {
      throw new Error(`No gamecards document found for lobby ${lobbyId}`);
    }

    const gameCards = gameCardsQuery.documents[0];

    // Use card data from gameCards
    state.discardWhite = gameCards.discardWhite || [];
    state.discardBlack = gameCards.discardBlack || [];

    if (state.phase !== 'judging') throw new Error('Not in judging phase');

    // Award point
    state.scores[winnerId] = (state.scores[winnerId] || 0) + 1;

    // Discard played white cards (ensure discardWhite exists)
    state.discardWhite = state.discardWhite || [];
    Object.values(state.submissions)
      .flat()
      .forEach((id) => state.discardWhite.push(id));

    // Discard the black card (ensure discardBlack exists)
    state.discardBlack = state.discardBlack || [];
    if (state.blackCard?.id) {
      state.discardBlack.push(state.blackCard.id);
    }

    // Clear submissions for the round
    state.submissions = {};
    state.playedCards = {}; // Also clear playedCards if used

    // Check win condition
    const maxScore = Math.max(...Object.values(state.scores));
    if (maxScore >= (lobby.winScore || 10)) {
      // Use configurable win score or default to 10
      state.phase = 'complete';
      state.roundWinner = winnerId; // Store final winner
      state.roundEndStartTime = null; // No countdown needed for game end
      log(`Game complete. Winner: ${winnerId} with ${maxScore} points.`);
    } else {
      // Transition to round end phase
      state.phase = 'roundEnd';
      state.roundWinner = winnerId; // Store round winner
      state.roundEndStartTime = Date.now(); // Record start time for countdown
      log(
        `Round ${state.round} ended. Winner: ${winnerId}. Starting countdown.`
      );
      // NOTE: Next round setup (judge rotation, card dealing) is moved to startNextRound function
    }

    // Extract updated discard piles for gameCards document
    // Only include the fields we need, excluding metadata fields like $databaseId
    const updatedGameCards = {
      lobbyId: gameCards.lobbyId,
      whiteDeck: gameCards.whiteDeck,
      blackDeck: gameCards.blackDeck,
      discardWhite: state.discardWhite,
      discardBlack: state.discardBlack,
      playerHands: gameCards.playerHands
    };

    // Create a clean state object without card data
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
    await databases.updateDocument(DB, GAMECARDS_COLLECTION, gameCards.$id, updatedGameCards);

    await databases.updateDocument(DB, LOBBY_COLLECTION, lobbyId, {
      status: state.phase === 'complete' ? 'complete' : 'playing', // Keep 'playing' during 'roundEnd'
      gameState: encodeGameState(coreState),
    });

    return res.json({ success: true, phase: state.phase });
  } catch (err) {
    error('selectWinner error: ' + err.message);
    return res.json({ success: false, error: err.message });
  }
}
