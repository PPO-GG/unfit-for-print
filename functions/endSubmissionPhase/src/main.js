// endSubmissionPhase/src/main.js
import { Client, Databases, Query } from 'node-appwrite';

const encodeGameState = (state) => {
  try {
    return JSON.stringify(state);
  } catch (err) {
    console.error('Failed to encode game state:', err);
    return '';
  }
};

const decodeGameState = (raw) => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Failed to decode game state:', err);
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

    let payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { lobbyId } = payload;
    if (!lobbyId) throw new Error('lobbyId is required');

    const lobby = await databases.getDocument(DB, LOBBY_COLLECTION, lobbyId);
    const state = decodeGameState(lobby.gameState);

    if (state.phase !== 'submitting') {
      return res.json({ success: false, error: 'Not in submitting phase' });
    }

    // Fetch gameCards to maintain structure
    const gameCardsQuery = await databases.listDocuments(DB, GAMECARDS_COLLECTION, [
      Query.equal('lobbyId', lobbyId)
    ]);
    if (gameCardsQuery.documents.length === 0) {
      throw new Error(`No gamecards document found for lobby ${lobbyId}`);
    }
    const gameCards = gameCardsQuery.documents[0];

    // Convert playerHands array to hands object
    state.hands = {};
    gameCards.playerHands.forEach((handString) => {
      const hand = JSON.parse(handString);
      state.hands[hand.playerId] = hand.cards;
    });

    state.phase = 'judging';

    const handsArray = Object.entries(state.hands).map(([playerId, cards]) =>
      JSON.stringify({ playerId, cards })
    );

    const updatedGameCards = {
      lobbyId: gameCards.lobbyId,
      whiteDeck: gameCards.whiteDeck,
      blackDeck: gameCards.blackDeck,
      discardWhite: gameCards.discardWhite,
      discardBlack: gameCards.discardBlack,
      playerHands: handsArray
    };

    const coreState = {
      phase: state.phase,
      judgeId: state.judgeId,
      blackCard: state.blackCard,
      submissions: state.submissions || {},
      playedCards: state.playedCards || {},
      scores: state.scores || {},
      round: state.round,
      roundWinner: state.roundWinner,
      winningCards: state.winningCards || null,
      roundEndStartTime: state.roundEndStartTime,
      submissionStartTime: state.submissionStartTime,
      submissionCountdownDuration: state.submissionCountdownDuration,
      returnedToLobby: state.returnedToLobby,
      gameEndTime: state.gameEndTime,
      config: state.config || {}
    };

    await databases.updateDocument(DB, GAMECARDS_COLLECTION, gameCards.$id, updatedGameCards);

    await databases.updateDocument(DB, LOBBY_COLLECTION, lobbyId, {
      gameState: encodeGameState(coreState),
      status: 'playing'
    });

    return res.json({ success: true });
  } catch (err) {
    error('endSubmissionPhase error: ' + err.message);
    return res.json({ success: false, error: err.message });
  }
}
