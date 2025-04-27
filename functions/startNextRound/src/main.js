// functions/startNextRound/src/main.js
import { Client, Databases, Query } from 'node-appwrite';

// Utility functions (consider moving to a shared lib)
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

// Helper to shuffle arrays
const shuffle = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export default async function ({ req, res, log, error }) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_FUNCTION_API_KEY);
  const databases = new Databases(client);
  const DB = process.env.APPWRITE_DATABASE_ID;
  const LOBBY_COLLECTION = process.env.LOBBY_COLLECTION;
  const WHITE_CARDS_COLLECTION = process.env.WHITE_CARDS_COLLECTION;
  const BLACK_CARDS_COLLECTION = process.env.BLACK_CARDS_COLLECTION;

  try {
    const raw = req.body ?? req.payload ?? '';
    log('Raw body:', raw);

    if (!raw) {
      throw new Error('Request body is empty');
    }

    let payload = raw;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        throw new Error(`Failed to parse JSON body: ${e.message}`);
      }
    }

    const { lobbyId } = payload;
    if (!lobbyId) throw new Error('lobbyId is required');

    // --- Fetch Lobby and Decode State ---
    const lobby = await databases.getDocument(DB, LOBBY_COLLECTION, lobbyId);
    const state = decodeGameState(lobby.gameState);
    const countdownDuration = (lobby.roundEndCountdownDuration || 5) * 1000; // In ms, default 5s

    // --- Validations ---
    if (state.phase !== 'roundEnd') {
      log(`Attempted to start next round for lobby ${lobbyId} but phase was ${state.phase}. Aborting.`);
      // Don't throw error, just return success=false to prevent unnecessary noise if called multiple times
      return res.json({ success: false, message: 'Not in roundEnd phase' });
    }

    // Optional: Time validation (prevent starting too early)
    const timeElapsed = Date.now() - (state.roundEndStartTime || 0);
    if (timeElapsed < countdownDuration - 500) { // Allow a small buffer (500ms)
        log(`Attempted to start next round too early for lobby ${lobbyId}. Time elapsed: ${timeElapsed}ms, Required: ${countdownDuration}ms`);
        return res.json({ success: false, message: 'Countdown not finished' });
    }

    log(`Starting next round for lobby ${lobbyId}. Current round: ${state.round}`);

    // --- Next Round Setup ---
    state.phase = 'submitting';
    state.round += 1;
    state.roundWinner = null; // Clear winner from previous round
    state.roundEndStartTime = null; // Clear start time

    // Rotate judge
    const playerIds = Object.keys(state.hands || {}); // Ensure hands exist
    if (playerIds.length > 0) {
        const currentJudgeIndex = playerIds.indexOf(state.judgeId);
        // Ensure judgeId is valid and exists in players
        const nextJudgeIndex = (currentJudgeIndex === -1 || currentJudgeIndex >= playerIds.length - 1)
                               ? 0
                               : currentJudgeIndex + 1;
        state.judgeId = playerIds[nextJudgeIndex];
        log(`New judge for round ${state.round}: ${state.judgeId}`);
    } else {
        log('No players found to assign judge.');
        state.judgeId = null;
    }


    // --- Card Management ---

    // Discard previous black card (ensure discardBlack exists)
    state.discardBlack = state.discardBlack || [];
    if (state.blackCard?.id) {
        state.discardBlack.push(state.blackCard.id);
    }

    // Check and refill black deck if needed
    if (!state.blackDeck || state.blackDeck.length < 1) {
        log('Black deck empty or missing, refilling from discard pile.');
        if (state.discardBlack && state.discardBlack.length > 0) {
            state.blackDeck = shuffle([...state.discardBlack]);
            state.discardBlack = [];
            log(`Refilled black deck with ${state.blackDeck.length} cards.`);
        } else {
            // If discard is also empty, fetch new cards (implement if needed)
            log('Warning: Black deck and discard pile are empty. Cannot draw new black card.');
            state.blackCard = null; // Set to null if no cards available
        }
    }

    // Draw next black card
    if (state.blackDeck && state.blackDeck.length > 0) {
        const nextBlackId = state.blackDeck.shift();
        try {
            const blackDoc = await databases.getDocument(DB, BLACK_CARDS_COLLECTION, nextBlackId);
            state.blackCard = {
                id: nextBlackId,
                text: blackDoc.text,
                pick: blackDoc.pick || 1, // Default pick to 1 if missing
            };
            log(`Drew new black card for round ${state.round}: ${state.blackCard.id} (Pick ${state.blackCard.pick})`);
        } catch (fetchError) {
            error(`Failed to fetch black card ${nextBlackId}: ${fetchError.message}`);
            state.blackCard = null; // Set to null if fetch fails
        }
    } else {
         state.blackCard = null; // Ensure blackCard is null if deck is empty
    }


    // Check and refill white deck if needed
    const requiredWhiteCards = playerIds.length * 7; // Estimate needed for full hands
    if (!state.whiteDeck || state.whiteDeck.length < requiredWhiteCards) {
        log(`White deck low (${state.whiteDeck?.length || 0} cards), refilling from discard pile.`);
        state.discardWhite = state.discardWhite || [];
        if (state.discardWhite.length > 0) {
            state.whiteDeck = shuffle([...(state.whiteDeck || []), ...state.discardWhite]);
            state.discardWhite = [];
            log(`Refilled white deck with ${state.whiteDeck.length} cards.`);
        } else {
            // If discard is also empty, fetch new cards (implement if needed)
            log('Warning: White deck and discard pile are empty. Cannot guarantee full hands.');
        }
    }

    // Refill hands
    state.hands = state.hands || {};
    playerIds.forEach((pid) => {
        state.hands[pid] = state.hands[pid] || []; // Ensure hand array exists
        const cardsNeeded = 7 - state.hands[pid].length;
        if (cardsNeeded > 0 && state.whiteDeck && state.whiteDeck.length > 0) {
            const cardsToDeal = state.whiteDeck.splice(0, Math.min(cardsNeeded, state.whiteDeck.length));
            state.hands[pid].push(...cardsToDeal);
            // log(`Dealt ${cardsToDeal.length} cards to player ${pid}. Hand size: ${state.hands[pid].length}`);
        } else if (cardsNeeded > 0) {
            log(`Could not deal ${cardsNeeded} cards to player ${pid}, deck empty.`);
        }
    });

    // Reset submissions for the new round
    state.submissions = {};
    state.playedCards = {}; // Also reset playedCards

    log(`Setup complete for round ${state.round}. Phase: ${state.phase}`);

    // --- Update Lobby ---
    await databases.updateDocument(DB, LOBBY_COLLECTION, lobbyId, {
      // status remains 'playing'
      gameState: encodeGameState(state),
    });

    return res.json({ success: true });

  } catch (err) {
    error(`startNextRound error for lobby ${payload?.lobbyId || 'UNKNOWN'}: ${err.message} \n Stack: ${err.stack}`);
    return res.json({ success: false, error: err.message });
  }
}