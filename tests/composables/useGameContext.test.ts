import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useGameContext } from '~/composables/useGameContext'

// Mock the useUserStore
vi.mock('~/stores/userStore', () => ({
  useUserStore: () => ({
    user: { $id: 'test-user-id' }
  })
}))

// Mock the useGameState
vi.mock('~/composables/useGameState', () => ({
  useGameState: () => ({
    decodeGameState: (raw: string | null) => raw ? JSON.parse(raw) : {}
  })
}))

describe('useGameContext', () => {
  let lobbyRef: any

  beforeEach(() => {
    // Reset the lobby reference before each test
    lobbyRef = ref(null)
  })

  it('should correctly identify when game is complete', () => {
    // Set up a lobby with a gameState that has 'complete' phase
    lobbyRef.value = {
      $id: 'test-lobby-id',
      status: 'playing',
      gameState: JSON.stringify({
        phase: 'complete',
        scores: {
          'player1': 5,
          'player2': 3,
          'test-user-id': 7
        }
      })
    }

    // Use the composable
    const { isComplete, leaderboard } = useGameContext(lobbyRef)

    // Check that isComplete is true
    expect(isComplete.value).toBe(true)
    
    // Check that leaderboard is correctly sorted
    expect(leaderboard.value).toHaveLength(3)
    expect(leaderboard.value[0].playerId).toBe('test-user-id')
    expect(leaderboard.value[0].points).toBe(7)
  })

  it('should correctly identify when game is not complete', () => {
    // Set up a lobby with a gameState that has a different phase
    lobbyRef.value = {
      $id: 'test-lobby-id',
      status: 'playing',
      gameState: JSON.stringify({
        phase: 'judging',
        scores: {
          'player1': 5,
          'player2': 3,
          'test-user-id': 7
        }
      })
    }

    // Use the composable
    const { isComplete } = useGameContext(lobbyRef)

    // Check that isComplete is false
    expect(isComplete.value).toBe(false)
  })
})