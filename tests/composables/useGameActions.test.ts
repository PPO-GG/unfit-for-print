import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameActions } from '~/composables/useGameActions'

// Mock the useAppwrite composable
vi.mock('~/composables/useAppwrite', () => ({
  useAppwrite: vi.fn(() => ({
    functions: {
      createExecution: vi.fn().mockResolvedValue({ response: 'success' })
    }
  }))
}))

describe('useGameActions', () => {
  let appwriteFunctions: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Get reference to the mocked functions
    appwriteFunctions = require('~/composables/useAppwrite').useAppwrite().functions
  })

  it('should call startGame with correct parameters', async () => {
    const { startGame } = useGameActions()
    const lobbyId = 'test-lobby-id'
    
    await startGame(lobbyId)
    
    // Check that createExecution was called with the correct function ID and payload
    expect(appwriteFunctions.createExecution).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ lobbyId })
    )
  })

  it('should call playCard with correct parameters', async () => {
    const { playCard } = useGameActions()
    const lobbyId = 'test-lobby-id'
    const playerId = 'test-player-id'
    const cardIds = ['card1', 'card2']
    
    await playCard(lobbyId, playerId, cardIds)
    
    // Check that createExecution was called with the correct function ID and payload
    expect(appwriteFunctions.createExecution).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ lobbyId, playerId, cardIds })
    )
  })

  it('should call selectWinner with correct parameters', async () => {
    const { selectWinner } = useGameActions()
    const lobbyId = 'test-lobby-id'
    const winnerId = 'test-winner-id'
    
    await selectWinner(lobbyId, winnerId)
    
    // Check that createExecution was called with the correct function ID and payload
    expect(appwriteFunctions.createExecution).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ lobbyId, winnerId })
    )
  })

  // Test for triggering game completion
  it('demonstrates how to trigger game completion in tests', async () => {
    // This test shows how to use selectWinner to trigger game completion
    // In a real application, this would be handled by the server
    
    const { selectWinner } = useGameActions()
    const lobbyId = 'test-lobby-id'
    const winnerId = 'test-winner-id'
    
    // Mock the server response to simulate game completion
    appwriteFunctions.createExecution.mockResolvedValueOnce({
      response: JSON.stringify({
        success: true,
        gameState: {
          phase: 'complete',
          scores: {
            'test-winner-id': 10,
            'other-player': 5
          }
        }
      })
    })
    
    const result = await selectWinner(lobbyId, winnerId)
    
    // Verify the function was called correctly
    expect(appwriteFunctions.createExecution).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ lobbyId, winnerId })
    )
    
    // Parse the mocked response
    const parsedResponse = JSON.parse(result.response)
    
    // Verify the game is now complete
    expect(parsedResponse.gameState.phase).toBe('complete')
    expect(parsedResponse.gameState.scores[winnerId]).toBe(10)
  })
})