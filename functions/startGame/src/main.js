// startGame/src/main.js
import { Client, Databases, Query } from 'node-appwrite';

// ── 1) Constants for collections ────────────────────────────────
const DB = process.env.APPWRITE_DATABASE_ID;
const LOBBY_COL = process.env.LOBBY_COLLECTION;
const WHITE_COL = process.env.WHITE_CARDS_COLLECTION;
const BLACK_COL = process.env.BLACK_CARDS_COLLECTION;
const PLAYER_COL = process.env.PLAYER_COLLECTION;
const GAMECARDS_COL = process.env.GAMECARDS_COLLECTION;
const GAMESETTINGS_COL = process.env.GAMESETTINGS_COLLECTION;

// ── 2) Helper: page through all IDs in a collection ───────────────────
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

// ── 3) Fisher–Yates shuffle ─────────────────────────────────────────────
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ── 4) Function handler ────────────────────────────────────────────────
export default async function ({ req, res, log, error }) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const databases = new Databases(client);

  try {
    // Parse & validate payload
    log('req.body:', req.body);
    log('typeof req.body:', typeof req.body);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    log('Parsed body:', body);
    log('documentId:', body?.documentId);
    const topLevelLobbyId = body?.lobbyId;
    const documentId = body?.documentId || topLevelLobbyId;
    let settings = body?.settings || null;
    if (!settings && documentId) {
      if (!GAMESETTINGS_COL) {
        throw new Error(
          'Missing environment variable: GAMESETTINGS_COLLECTION'
        );
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
    if (!settings || !settings.lobbyId) {
      throw new Error('Game settings are missing or invalid');
    }

    log('Resolved settings:', settings);
    if (!topLevelLobbyId) throw new Error('lobbyId missing');

    // Log the parsed payload for debugging
    log('Parsed payload:', { topLevelLobbyId, documentId, settings });

    // 1) Load lobby + players
    log('About to fetch lobby with lobbyId:', topLevelLobbyId);
    const lobby = await databases.getDocument(DB, LOBBY_COL, topLevelLobbyId);
    const playersRes = await databases.listDocuments(DB, PLAYER_COL, []);
    const playerIds = playersRes.documents.map((d) => d.userId);
    const playerCount = playerIds.length;

    // 2) Build white-card deck once
    // Pass cardPacks from settings if available
    log('Using card packs:', settings?.cardPacks || 'default (all)');
    const allWhiteIds = shuffle(
      await fetchAllIds(WHITE_COL, databases, DB, settings?.cardPacks)
    );
    // Use numPlayerCards from settings if available, otherwise default to 7
    const CARDS_PER_PLAYER = settings?.numPlayerCards || 7;
    log('Cards per player:', CARDS_PER_PLAYER);
    const EXTRA_WHITES = 20;
    const totalWhites = playerCount * CARDS_PER_PLAYER + EXTRA_WHITES;

    // Deal hands
    const hands = {};
    playerIds.forEach((pid, idx) => {
      const start = idx * CARDS_PER_PLAYER;
      hands[pid] = allWhiteIds.slice(start, start + CARDS_PER_PLAYER);
    });

    // Build draw-pile (the extra whites)
    const whiteDeck = allWhiteIds.slice(
      playerCount * CARDS_PER_PLAYER,
      totalWhites
    );

    // 3) Build a deck of black cards
    // Pass cardPacks from settings if available
    const allBlackIds = shuffle(
      await fetchAllIds(BLACK_COL, databases, DB, settings?.cardPacks)
    );
    const INITIAL_BLACK_CARDS = 5; // Number of black cards to start with

    // Take the first card for the current round
    if (!Array.isArray(allBlackIds) || allBlackIds.length === 0) {
      throw new Error('No black cards available for selected card packs');
    }
    log('allBlackIds:', allBlackIds);
    log('firstBlackId:', allBlackIds[0]);
    const firstBlackId = allBlackIds[0];
    const firstBlack = await databases.getDocument(DB, BLACK_COL, firstBlackId);

    // The rest go into the black deck
    const blackDeck = allBlackIds.slice(1, INITIAL_BLACK_CARDS);

    // 4) Assemble a lean gameState (without card data)
    const maxPoints = settings?.maxPoints || 10; // Use maxPoints from settings if available, otherwise default to 10
    log('Max points to win:', maxPoints);

    const gameState = {
      phase: 'submitting',
      judgeId: lobby.hostUserId,
      blackCard: {
        id: firstBlack.$id,
        text: firstBlack.text,
        pick: firstBlack.pick,
      },
      submissions: {},
      playedCards: {},
      scores: playerIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
      round: 1,
      roundWinner: null,
      roundEndStartTime: null,
      gameEndTime: null,
      returnedToLobby: {},

      // Now include the selected settings
      config: {
        maxPoints: settings?.maxPoints || 10,
        cardsPerPlayer: settings?.numPlayerCards || 7,
        cardPacks: settings?.cardPacks || [],
        isPrivate: settings?.isPrivate || false,
        lobbyName: settings?.lobbyName || 'Unnamed Game',
      },
    };

    // 5) Create a separate gamecards document
    // convert the hands object into an array of small objects
    const handsArray = Object.entries(hands).map(([playerId, cards]) =>
      JSON.stringify({ playerId, cards })
    );

    const gameCards = {
      lobbyId: topLevelLobbyId,
      whiteDeck: whiteDeck,
      blackDeck: blackDeck,
      discardWhite: [],
      discardBlack: [],
      playerHands: handsArray, // Array<string> ✓
    };

    // 6) Persist both documents
    await databases.createDocument(DB, GAMECARDS_COL, 'unique()', gameCards);

    await databases.updateDocument(DB, LOBBY_COL, topLevelLobbyId, {
      status: 'playing',
      gameState: JSON.stringify(gameState),
    });

    log('Game successfully started with settings:', {
      cardsPerPlayer: settings.numPlayerCards || 7,
      maxPoints: maxPoints,
      cardPacks: settings?.cardPacks || 'default (all)',
      playerCount: playerCount,
    });

    return res.json({ success: true });
  } catch (err) {
    error('startGame error:', err);
    return res.json({ success: false, error: err.message });
  }
}
