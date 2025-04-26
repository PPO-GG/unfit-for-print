import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Lobby } from '~/types/lobby'

/**
 * Test utilities for game-related tests
 */
export const gameTestUtils = {
  /**
   * Creates a mock lobby with the specified game state
   * @param gameState The game state to set
   * @param lobbyId Optional lobby ID (defaults to 'test-lobby')
   * @param hostUserId Optional host user ID (defaults to 'host-user')
   * @returns A ref containing the mock lobby
   */
  createMockLobby(
    gameState: Record<string, any> = {}, 
    lobbyId: string = 'test-lobby',
    hostUserId: string = 'host-user'
  ): Ref<Lobby> {
    return ref({
      $id: lobbyId,
      hostUserId,
      status: 'playing',
      gameState: JSON.stringify(gameState),
      name: 'Test Lobby',
      maxPlayers: 8,
      minPlayers: 3,
      password: null,
      winningScore: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Lobby)
  },

  /**
   * Creates a mock player list
   * @param playerIds Array of player IDs
   * @returns Array of mock player objects
   */
  createMockPlayers(playerIds: string[] = ['player1', 'player2']) {
    return playerIds.map((id, index) => ({
      $id: id,
      name: `Player ${index + 1}`,
      avatarUrl: null,
      score: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
  },

  /**
   * Triggers the winning screen by setting the game state to complete
   * @param lobbyRef Ref to the lobby object
   * @param scores Optional scores object (defaults to player1: 10, player2: 5)
   */
  triggerWinningScreen(
    lobbyRef: Ref<Lobby>,
    scores: Record<string, number> = { 'player1': 10, 'player2': 5 }
  ) {
    // Create a complete game state
    const completeGameState = {
      phase: 'complete',
      scores,
      round: 5, // Assuming the game ended after 5 rounds
    }
    
    // Update the lobby ref with the complete game state
    if (lobbyRef.value) {
      lobbyRef.value.gameState = JSON.stringify(completeGameState)
    }
    
    return completeGameState
  },

  /**
   * Creates a mock game context with the specified state
   * @param isComplete Whether the game is complete
   * @param leaderboard Optional leaderboard data
   * @returns Mock game context object with reactive properties
   */
  createMockGameContext(
    isComplete: boolean = false,
    leaderboard: Array<{playerId: string, points: number}> = []
  ) {
    return {
      state: ref({}),
      isWaiting: ref(false),
      isSubmitting: ref(false),
      isPlaying: ref(!isComplete),
      isJudging: ref(false),
      isComplete: ref(isComplete),
      czarId: ref(null),
      isCzar: ref(false),
      blackCard: ref(null),
      submissions: ref({}),
      mySubmission: ref(null),
      otherSubmissions: ref([]),
      hands: ref({}),
      myHand: ref([]),
      scores: ref({}),
      leaderboard: ref(leaderboard)
    }
  }
}