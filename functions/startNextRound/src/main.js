// startNextRound/src/main.js
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

// Helper to fetch all IDs from a collection
async function fetchAllIds(collectionId, databases, DB, cardPacks = null) {
  const BATCH = 100;
  let queries = [Query.limit(1)];

  // Add filter for card packs if specified
  if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
    // Create an array of pack conditions
    const packConditions = cardPacks.map(pack => Query.equal('pack', pack));

    // If we have multiple packs, use Query.or to combine them
    if (packConditions.length > 1) {
      queries.push(Query.or(packConditions));
    } else if (packConditions.length === 1) {
      // If we only have one pack, just add it directly
      queries.push(packConditions[0]);
    }
  }

  // get total count
  const { total } = await databases.listDocuments(DB, collectionId, queries);
  const ids = [];

  for (let offset = 0; offset < total; offset += BATCH) {
    let batchQueries = [Query.limit(BATCH), Query.offset(offset)];

    // Add filter for card packs if specified
    if (cardPacks && Array.isArray(cardPacks) && cardPacks.length > 0) {
      // Create an array of pack conditions
      const packConditions = cardPacks.map(pack => Query.equal('pack', pack));

      // If we have multiple packs, use Query.or to combine them
      if (packConditions.length > 1) {
        batchQueries.push(Query.or(packConditions));
      } else if (packConditions.length === 1) {
        // If we only have one pack, just add it directly
        batchQueries.push(packConditions[0]);
      }
    }

    const res = await databases.listDocuments(DB, collectionId, batchQueries);
    ids.push(...res.documents.map((d) => d.$id));
  }
  return ids;
}

export default async function ({ req, res, log, error }) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const databases = new Databases(client);
  const DB = process.env.APPWRITE_DATABASE_ID;
  const LOBBY_COLLECTION = process.env.LOBBY_COLLECTION;
  const WHITE_CARDS_COLLECTION = process.env.WHITE_CARDS_COLLECTION;
  const BLACK_CARDS_COLLECTION = process.env.BLACK_CARDS_COLLECTION;
  const GAMECARDS_COLLECTION = process.env.GAMECARDS_COLLECTION;
  const GAMESETTINGS_COL = process.env.GAMESETTINGS_COLLECTION;

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

    const { lobbyId, documentId } = payload;
    if (!lobbyId) throw new Error('lobbyId is required');

    // --- Fetch Game Settings if documentId is provided ---
    let settings = null;
    if (documentId) {
      if (!GAMESETTINGS_COL) {
        throw new Error('Missing environment variable: GAMESETTINGS_COLLECTION');
      }

      log('Fetching settings from documentId:', documentId);
      try {
        settings = await databases.getDocument(
          DB,
          GAMESETTINGS_COL,
          documentId
        );
      } catch (err) {
        error('Failed to fetch settings by documentId:', err);
        throw new Error('Could not load game settings from documentId');
      }
    }

    // --- Fetch Lobby and Decode State ---
    const lobby = await databases.getDocument(DB, LOBBY_COLLECTION, lobbyId);
    const state = decodeGameState(lobby.gameState);
    const countdownDuration = (lobby.roundEndCountdownDuration || 5) * 1000; // In ms, default 5s

    // --- Fetch GameCards document ---
    const gameCardsQuery = await databases.listDocuments(DB, GAMECARDS_COLLECTION, [
      Query.equal('lobbyId', lobbyId)
    ]);

    if (gameCardsQuery.documents.length === 0) {
      throw new Error(`No gamecards document found for lobby ${lobbyId}`);
    }

    const gameCards = gameCardsQuery.documents[0];

    // Merge card data from gameCards into state for processing
    state.whiteDeck = gameCards.whiteDeck;
    state.blackDeck = gameCards.blackDeck;
    state.discardWhite = gameCards.discardWhite;
    state.discardBlack = gameCards.discardBlack;

    // Convert playerHands array to hands object
      state.hands = {};
      gameCards.playerHands.forEach(handString => {
          const hand = JSON.parse(handString);
          state.hands[hand.playerId] = hand.cards;
      });

    // --- Validations ---
    if (state.phase !== 'roundEnd') {
      log(`Attempted to start next round for lobby ${lobbyId} but phase was ${state.phase}. Aborting.`);
      // Don't throw error, just return success=false to prevent unnecessary noise if called multiple times
      return res.json({ success: false, message: 'Not in roundEnd phase' });
    }

    // Optional: Time validation (prevent starting too early)
    const timeElapsed = Date.now() - (state.roundEndStartTime || 0);
    if (timeElapsed < countdownDuration - 600) { // Allow a buffer (600ms) to account for timing variations
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
    // We want to maintain a minimum number of black cards in the deck
    const MIN_BLACK_CARDS = 5;
    if (!state.blackDeck || state.blackDeck.length < MIN_BLACK_CARDS) {
        log(`Black deck low (${state.blackDeck?.length || 0} cards), fetching new cards from database.`);

        // Fetch all black card IDs from the database
        try {
            // Get all black card IDs, using card packs from config if available
            log('Using card packs for black cards:', state.config?.cardPacks || 'default (all)');
            const allBlackIds = await fetchAllIds(BLACK_CARDS_COLLECTION, databases, DB, state.config?.cardPacks);

            // Filter out cards that are in the discard pile or currently in the deck
            state.discardBlack = state.discardBlack || [];
            const currentDeck = state.blackDeck || [];

            // Cards that are already in use (in discard or in current deck)
            const cardsInUse = [...state.discardBlack, ...currentDeck];
            if (state.blackCard?.id) {
                cardsInUse.push(state.blackCard.id);
            }

            const availableBlackIds = allBlackIds.filter(id => !cardsInUse.includes(id));

            if (availableBlackIds.length > 0) {
                // If we have new cards available, use them
                // Limit the number of black cards
                const MAX_BLACK_CARDS = 50; // Set desired limit
                const newCards = shuffle(availableBlackIds).slice(0, MAX_BLACK_CARDS);
                state.blackDeck = [...(state.blackDeck || []), ...newCards];
                log(`Fetched and added ${newCards.length} new black cards from database. Deck now has ${state.blackDeck.length} cards.`);
            } else if (state.discardBlack && state.discardBlack.length > 0) {
                // If all cards have been used, refill from discard pile
                log('All black cards have been used, refilling from discard pile.');
                const discardedCards = shuffle([...state.discardBlack]);
                state.blackDeck = [...(state.blackDeck || []), ...discardedCards];
                state.discardBlack = [];
                log(`Refilled black deck with ${discardedCards.length} cards from discard pile. Deck now has ${state.blackDeck.length} cards.`);
            } else {
                // If both database and discard are empty
                log('Warning: No black cards available in database or discard pile.');
                if (!state.blackDeck || state.blackDeck.length === 0) {
                    state.blackCard = null; // Set to null if no cards available and deck is empty
                }
            }
        } catch (fetchError) {
            error(`Failed to fetch black cards from database: ${fetchError.message}`);
            // Fall back to discard pile if database fetch fails
            if (state.discardBlack && state.discardBlack.length > 0) {
                const discardedCards = shuffle([...state.discardBlack]);
                state.blackDeck = [...(state.blackDeck || []), ...discardedCards];
                state.discardBlack = [];
                log(`Fallback: Refilled black deck with ${discardedCards.length} cards from discard pile. Deck now has ${state.blackDeck.length} cards.`);
            } else if (!state.blackDeck || state.blackDeck.length === 0) {
                state.blackCard = null;
            }
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
    // Use numPlayerCards from settings if available, otherwise fall back to state.config or default to 7
    const CARDS_PER_PLAYER = settings?.numPlayerCards || state.config?.cardsPerPlayer || 7;
    log('Cards per player:', CARDS_PER_PLAYER);
    const requiredWhiteCards = playerIds.length * CARDS_PER_PLAYER; // Estimate needed for full hands
    if (!state.whiteDeck || state.whiteDeck.length < requiredWhiteCards) {
        log(`White deck low (${state.whiteDeck?.length || 0} cards), fetching new cards from database.`);

        // Fetch all white card IDs from the database
        try {
            // Get all white card IDs, using card packs from config if available
            log('Using card packs for white cards:', state.config?.cardPacks || 'default (all)');
            const allWhiteIds = await fetchAllIds(WHITE_CARDS_COLLECTION, databases, DB, state.config?.cardPacks);

            // Filter out cards that are in the discard pile or already in players' hands
            state.discardWhite = state.discardWhite || [];
            const currentDeck = state.whiteDeck || [];

            // Collect all cards that are already in use (in discard, in deck, or in hands)
            const cardsInUse = [...state.discardWhite, ...currentDeck];
            Object.values(state.hands || {}).forEach(hand => {
                cardsInUse.push(...hand);
            });

            // Filter to get only cards not in use
            const availableWhiteIds = allWhiteIds.filter(id => !cardsInUse.includes(id));

            if (availableWhiteIds.length > 0) {
                // If we have new cards available, use them
                // Limit the number of white cards
                const MAX_WHITE_CARDS = 100; // Set desired limit
                const newCards = shuffle(availableWhiteIds).slice(0, MAX_WHITE_CARDS);
                state.whiteDeck = [...(state.whiteDeck || []), ...newCards];
                log(`Fetched and added ${newCards.length} new white cards from database. Deck now has ${state.whiteDeck.length} cards.`);
            } else if (state.discardWhite.length > 0) {
                // If all cards have been used, refill from discard pile
                log('All white cards have been used, refilling from discard pile.');
                state.whiteDeck = shuffle([...(state.whiteDeck || []), ...state.discardWhite]);
                state.discardWhite = [];
                log(`Refilled white deck with ${state.whiteDeck.length} cards from discard pile.`);
            } else {
                // If both database and discard are empty
                log('Warning: No white cards available in database or discard pile. Cannot guarantee full hands.');
            }
        } catch (fetchError) {
            error(`Failed to fetch white cards from database: ${fetchError.message}`);
            // Fall back to discard pile if database fetch fails
            if (state.discardWhite.length > 0) {
                state.whiteDeck = shuffle([...(state.whiteDeck || []), ...state.discardWhite]);
                state.discardWhite = [];
                log(`Fallback: Refilled white deck with ${state.whiteDeck.length} cards from discard pile.`);
            } else {
                log('Warning: Failed to fetch white cards and discard pile is empty. Cannot guarantee full hands.');
            }
        }
    }

    // Refill hands
    state.hands = state.hands || {};
    playerIds.forEach((pid) => {
        state.hands[pid] = state.hands[pid] || []; // Ensure hand array exists
        // Use CARDS_PER_PLAYER from game settings to determine how many cards each player should have
        const cardsNeeded = CARDS_PER_PLAYER - state.hands[pid].length;
        if (cardsNeeded > 0 && state.whiteDeck && state.whiteDeck.length > 0) {
            const cardsToDeal = state.whiteDeck.splice(0, Math.min(cardsNeeded, state.whiteDeck.length));
            state.hands[pid].push(...cardsToDeal);
            log(`Dealt ${cardsToDeal.length} cards to player ${pid}. Hand size: ${state.hands[pid].length}/${CARDS_PER_PLAYER}`);
        } else if (cardsNeeded > 0) {
            log(`Could not deal ${cardsNeeded} cards to player ${pid}, deck empty.`);
        }
    });

    // Reset submissions for the new round
    state.submissions = {};
    state.playedCards = {}; // Also reset playedCards

    log(`Setup complete for round ${state.round}. Phase: ${state.phase}`);

    // --- Extract card data for gameCards document ---
    // Convert hands object back to playerHands array
      const handsArray = Object.entries(state.hands || {}).map(
          ([playerId, cards]) => JSON.stringify({ playerId, cards })
      );

      const updatedGameCards = {
          whiteDeck: state.whiteDeck || [],
          blackDeck: state.blackDeck || [],
          discardWhite: state.discardWhite || [],
          discardBlack: state.discardBlack || [],
          playerHands: handsArray,
          // Keep the lobbyId unchanged
          lobbyId: lobbyId
      };

    // --- Create a clean state object without card data ---
    // Instead of modifying the original state object, create a new object with only the core game state properties
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
        gameEndTime: state.gameEndTime,
        // Preserve the config object to ensure game settings are maintained across rounds
        config: state.config || {
            maxPoints: 10,
            cardsPerPlayer: CARDS_PER_PLAYER, // Use the CARDS_PER_PLAYER value
            cardPacks: [],
            isPrivate: false,
            lobbyName: 'Unnamed Game'
        }
    };

    // --- Update both documents ---
    // Update gameCards document
    await databases.updateDocument(DB, GAMECARDS_COLLECTION, gameCards.$id, updatedGameCards);

    // Update lobby document
    await databases.updateDocument(DB, LOBBY_COLLECTION, lobbyId, {
      // status remains 'playing'
      gameState: encodeGameState(coreState),
    });

    return res.json({ success: true });

  } catch (err) {
    // Use req.body or req.payload if available, otherwise use a safe fallback
    const requestData = req.body ?? req.payload ?? {};
    const lobbyId = typeof requestData === 'string' 
      ? JSON.parse(requestData)?.lobbyId || 'UNKNOWN'
      : requestData?.lobbyId || 'UNKNOWN';

    error(`startNextRound error for lobby ${lobbyId}: ${err.message} \n Stack: ${err.stack}`);
    return res.json({ success: false, error: err.message });
  }
}
