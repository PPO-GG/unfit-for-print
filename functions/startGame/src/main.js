// functions/startGame.js
import { Client, Databases, Query } from 'node-appwrite'

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

    // 3) Load card decks with randomization
    // First, get total counts
    const whitesCountRes = await databases.listDocuments(DB, process.env.WHITE_CARDS_COLLECTION, [
      Query.limit(1)
    ])
    const blacksCountRes = await databases.listDocuments(DB, process.env.BLACK_CARDS_COLLECTION, [
      Query.limit(1)
    ])

    const whiteTotal = whitesCountRes.total
    const blackTotal = blacksCountRes.total

    // Calculate how many white cards we need (7 per player + some extra for the deck)
    const playersRes = await databases.listDocuments(DB, process.env.PLAYER_COLLECTION, [])
    const playerCount = playersRes.documents.length
    const neededWhiteCards = (playerCount * 7) + 20

    // For black cards, we'll still use the offset approach since we need fewer
    const blackOffset = Math.floor(Math.random() * Math.max(1, blackTotal - 20))
    log('Using black offset:', blackOffset, 'of', blackTotal, 'total cards')

    // Fetch black cards with random offset
    const blacks = await databases.listDocuments(DB, process.env.BLACK_CARDS_COLLECTION, [
      Query.limit(20),
      Query.offset(blackOffset)
    ])

    // For white cards, we'll fetch them individually with random offsets
    // to ensure true randomness
    log('Fetching white cards randomly one by one')

    // 4) Shuffle black deck (Fisher–Yates)
    const shuffle = arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }
    const blackDeck = shuffle(blacks.documents.map(d => d.$id))

    // 5) Fetch random white cards and deal initial hands
    const playerIds = playersRes.documents.map(d => d.userId)
    const hands = {}
    const whiteDeck = []

    // Keep track of all cards that have been dealt to prevent duplicates
    const dealtCards = new Set()

    // Function to fetch a single random white card that hasn't been dealt yet
    const fetchRandomWhiteCard = async () => {
      let attempts = 0
      let cardId

      // Try up to 10 times to get a unique card
      while (attempts < 10) {
        const randomOffset = Math.floor(Math.random() * whiteTotal)
        const card = await databases.listDocuments(DB, process.env.WHITE_CARDS_COLLECTION, [
          Query.limit(1),
          Query.offset(randomOffset)
        ])
        cardId = card.documents[0].$id

        // If this card hasn't been dealt yet, use it
        if (!dealtCards.has(cardId)) {
          dealtCards.add(cardId)
          return cardId
        }

        attempts++
      }

      // If we couldn't find a unique card after 10 attempts, try a different approach
      // Get a batch of cards and find the first one that hasn't been dealt
      const batchSize = 50
      const randomOffset = Math.floor(Math.random() * Math.max(1, whiteTotal - batchSize))
      const cards = await databases.listDocuments(DB, process.env.WHITE_CARDS_COLLECTION, [
        Query.limit(batchSize),
        Query.offset(randomOffset)
      ])

      for (const card of cards.documents) {
        if (!dealtCards.has(card.$id)) {
          dealtCards.add(card.$id)
          return card.$id
        }
      }

      // If we still couldn't find a unique card, log an error and return any card
      // This should be extremely rare
      log('Warning: Could not find a unique card after multiple attempts')
      return cardId
    }

    // Deal 7 random cards to each player
    for (const pid of playerIds) {
      hands[pid] = []
      for (let i = 0; i < 7; i++) {
        const cardId = await fetchRandomWhiteCard()
        hands[pid].push(cardId)
      }
    }

    // Add some extra cards to the deck
    for (let i = 0; i < 20; i++) {
      const cardId = await fetchRandomWhiteCard()
      whiteDeck.push(cardId)
    }

    // 6) Set up game state
    const judgeId = lobby.hostUserId
    const firstBlackId = blackDeck.shift()
    const firstBlack = blacks.documents.find(d => d.$id === firstBlackId)

    const gameState = {
      phase: 'submitting',
      judgeId,
      blackCard: { id: firstBlack.$id, text: firstBlack.text, pick: firstBlack.pick },
      submissions: {},
      playedCards: {},
      hands,
      whiteDeck,
      blackDeck,
      discardedWhiteCards: [], // Updated field name to match useGameEngine.ts
      discardBlack: [],
      submittedCards: {}, // Added field to match useGameEngine.ts
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
