// functions/selectWinner.js
import { Client, Databases } from 'node-appwrite';

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
      process.env.LOBBY_COLLECTION,
      lobbyId
    );
    const state = decodeGameState(lobby.gameState);

    if (state.phase !== 'judging') throw new Error('Not in judging phase');

    // Award point
    state.scores[winnerId] = (state.scores[winnerId] || 0) + 1;

    // Discard played cards
    Object.values(state.submissions)
      .flat()
      .forEach((id) => state.discardedWhiteCards.push(id));

    // Check win condition
    const maxScore = Math.max(...Object.values(state.scores));
    if (maxScore >= 10) {
      state.phase = 'complete';
    } else {
      // Next round setup
      state.phase = 'submitting';
      state.round += 1;

      // Rotate czar
      const pids = Object.keys(state.hands);
      const idx = pids.indexOf(state.judgeId);
      state.judgeId = pids[(idx + 1) % pids.length];

      // Draw next black card
      state.discardBlack.push(state.blackCard.id);
      const nextBlack = state.blackDeck.shift();
      const blackDoc = await databases.getDocument(
        DB,
        process.env.BLACK_CARDS_COLLECTION,
        nextBlack
      );
      state.blackCard = {
        id: nextBlack,
        text: blackDoc.text,
        pick: blackDoc.pick,
      };

      // Check if we need to reshuffle the discard pile
      if (state.whiteDeck.length < Object.keys(state.hands).length * 7) {
        log('Reshuffling discard pile into deck');
        // Shuffle the discard pile
        for (let i = state.discardedWhiteCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.discardedWhiteCards[i], state.discardedWhiteCards[j]] = [
            state.discardedWhiteCards[j],
            state.discardedWhiteCards[i],
          ];
        }
        // Add the discard pile back to the deck
        state.whiteDeck.push(...state.discardedWhiteCards);
        // Clear the discard pile
        state.discardedWhiteCards = [];
      }

      // Refill hands - ensure all players have exactly 7 cards
      pids.forEach((pid) => {
        // Calculate how many cards the player needs to reach 7
        const currentHandSize = state.hands[pid].length;
        // Calculate how many cards are needed to get back to 7
        const cardsNeeded = 7 - currentHandSize;

        // Add cards if needed
        if (cardsNeeded > 0) {
          state.hands[pid].push(...state.whiteDeck.splice(0, cardsNeeded));
        }
      });

      // Reset submissions
      state.submissions = {};
      // Also reset playedCards for client-side compatibility
      state.playedCards = {};
    }

    await databases.updateDocument(DB, process.env.LOBBY_COLLECTION, lobbyId, {
      status: state.phase === 'complete' ? 'complete' : 'playing',
      gameState: encodeGameState(state),
    });

    return res.json({ success: true });
  } catch (err) {
    error('selectWinner error: ' + err.message);
    return res.json({ success: false, error: err.message });
  }
}
