// functions/startGame.js
import { Client, Databases } from 'node-appwrite'

// Utility function for encoding game state
const encodeGameState = (state) => {
  try {
    return JSON.stringify(state)
  } catch (error) {
    console.error('Failed to encode game state:', error)
    return ''
  }
}

export default async function ({ req, res, log, error }) {
  log('✅ ENV DEBUG:');
  log('Endpoint:', process.env.APPWRITE_FUNCTION_API_ENDPOINT);
  log('Project ID:', process.env.APPWRITE_FUNCTION_PROJECT_ID);
  log('API Key exists?', !!process.env.APPWRITE_API_KEY);
  log('Database ID:', process.env.APPWRITE_DATABASE_ID);
  // 1) Initialize Appwrite SDK
  const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

  const databases = new Databases(client)
  const DB = process.env.APPWRITE_DATABASE_ID

  try {
    const raw = req.body ?? req.payload ?? ''
    log('Raw body:', raw)

    if (!raw) {
      throw new Error('Request body is empty')
    }

    // Parse JSON if needed
    let payload = raw
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch (e) {
        throw new Error(`Failed to parse JSON body: ${e.message}`)
      }
    }

    // Extract lobbyId from the payload
    const lobbyId = payload.lobbyId

    // Check if lobbyId is undefined or null
    if (!lobbyId) {
      throw new Error('lobbyId is undefined or null')
    }

    // Log the lobbyId for debugging
    log('Using lobbyId:', lobbyId)

    // 2) Fetch lobby document
    const lobby = await databases.getDocument(DB, process.env.LOBBY_COLLECTION, lobbyId)

    // 3) Load card decks
    const whites = await databases.listDocuments(DB, process.env.WHITE_CARDS_COLLECTION, [])
    const blacks = await databases.listDocuments(DB, process.env.BLACK_CARDS_COLLECTION, [])

    // 4) Shuffle decks (Fisher–Yates)
    const shuffle = arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }
    const whiteDeck = shuffle(whites.documents.map(d => d.$id))
    const blackDeck = shuffle(blacks.documents.map(d => d.$id))

    // 5) Deal initial hands
    const playersRes = await databases.listDocuments(DB, process.env.PLAYER_COLLECTION, [])
    const playerIds = playersRes.documents.map(d => d.userId)
    const hands = {}
    playerIds.forEach(pid => {
      hands[pid] = whiteDeck.splice(0, 7)
    })

    // 6) Set up game state
    const czarId = lobby.hostUserId
    const firstBlackId = blackDeck.shift()
    const firstBlack = blacks.documents.find(d => d.$id === firstBlackId)

    const gameState = {
      phase: 'submitting',
      czarId,
      blackCard: { id: firstBlack.$id, text: firstBlack.text, pick: firstBlack.pick },
      submissions: {},
      playedCards: {},
      hands,
      whiteDeck,
      blackDeck,
      discardWhite: [],
      discardBlack: [],
      scores: playerIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
      round: 1
    }

    // 7) Update lobby document
    await databases.updateDocument(DB, process.env.LOBBY_COLLECTION, lobbyId, {
      status: 'playing',
      gameState: encodeGameState(gameState)
    })

    return res.json({ success: true })
  } catch (err) {
    error('startGame error: ' + err.message)
    return res.json({ success: false, error: err.message })
  }
}
