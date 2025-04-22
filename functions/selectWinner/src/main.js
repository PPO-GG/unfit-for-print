// functions/selectWinner.js
import { Client, Databases } from 'node-appwrite'

// Utility functions for encoding/decoding game state
const encodeGameState = (state) => {
  try {
    return JSON.stringify(state)
  } catch (error) {
    console.error('Failed to encode game state:', error)
    return ''
  }
}

const decodeGameState = (raw) => {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    console.error('Failed to decode game state:', error)
    return {}
  }
}

export default async function ({ req, res, error }) {
  const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers['x-appwrite-key'] ?? '')

  const databases = new Databases(client)
  const DB = process.env.APPWRITE_DATABASE_ID

  try {
    const { lobbyId, winnerId } = req.payload

    const lobby = await databases.getDocument(DB, 'lobby', lobbyId)
    const state = decodeGameState(lobby.gameState)

    if (state.phase !== 'judging') throw new Error('Not in judging phase')

    // Award point
    state.scores[winnerId] = (state.scores[winnerId] || 0) + 1

    // Discard played cards
    Object.values(state.submissions).flat().forEach(id => state.discardWhite.push(id))

    // Check win condition
    const maxScore = Math.max(...Object.values(state.scores))
    if (maxScore >= 10) {
      state.phase = 'complete'
    } else {
      // Next round setup
      state.phase = 'submitting'
      state.round += 1

      // Rotate czar
      const pids = Object.keys(state.hands)
      const idx = pids.indexOf(state.czarId)
      state.czarId = pids[(idx + 1) % pids.length]

      // Draw next black card
      state.discardBlack.push(state.blackCard.id)
      const nextBlack = state.blackDeck.shift()
      const blackDoc = await databases.getDocument(DB, 'cards_black', nextBlack)
      state.blackCard = { id: nextBlack, text: blackDoc.text, pick: blackDoc.pick }

      // Refill hands
      pids.forEach(pid => {
        const needed = 1
        state.hands[pid].push(...state.whiteDeck.splice(0, needed))
      })

      // Reset submissions
      state.submissions = {}
      // Also reset playedCards for client-side compatibility
      state.playedCards = {}
    }

    await databases.updateDocument(DB, 'lobby', lobbyId, {
      status: state.phase === 'complete' ? 'complete' : 'playing',
      gameState: encodeGameState(state)
    })

    return res.json({ success: true })
  } catch (err) {
    error('selectWinner error: ' + err.message)
    return res.json({ success: false, error: err.message })
  }
}
