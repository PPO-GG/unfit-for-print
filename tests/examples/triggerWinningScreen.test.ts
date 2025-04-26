import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { gameTestUtils } from '../utils/gameTestUtils'
import GameBoard from '~/components/game/GameBoard.vue'

// Mock the necessary composables
vi.mock('~/composables/useGameContext', () => ({
  useGameContext: vi.fn()
}))

vi.mock('~/composables/useGameActions', () => ({
  useGameActions: vi.fn(() => ({
    startGame: vi.fn(),
    playCard: vi.fn(),
    selectWinner: vi.fn()
  }))
}))

vi.mock('~/composables/useCards', () => ({
  useCards: vi.fn(() => ({
    getWhiteCardText: vi.fn(),
    getBlackCardText: vi.fn()
  }))
}))

vi.mock('~/composables/useLobby', () => ({
  useLobby: vi.fn(() => ({
    leaveLobby: vi.fn()
  }))
}))

describe('Trigger Winning Screen Example', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('demonstrates how to trigger the winning screen using gameTestUtils', async () => {
    // Create a mock lobby with initial game state (not complete)
    const lobbyRef = gameTestUtils.createMockLobby({
      phase: 'judging',
      round: 3,
      scores: { 'player1': 7, 'player2': 4 }
    })
    
    // Create mock players
    const players = gameTestUtils.createMockPlayers(['player1', 'player2'])
    
    // Create a mock game context (not complete)
    const mockGameContext = gameTestUtils.createMockGameContext(false)
    
    // Mock the useGameContext to return our mock context
    vi.mocked(require('~/composables/useGameContext').useGameContext).mockReturnValue(mockGameContext)
    
    // Mount the GameBoard component
    const wrapper = mount(GameBoard, {
      props: {
        lobby: lobbyRef.value,
        players
      },
      global: {
        stubs: {
          'PlayerList': true,
          'BlackCardComponent': true,
          'whiteCard': true,
          'UserHand': true
        }
      }
    })
    
    // Initially, the winning screen should not be displayed
    expect(wrapper.text()).not.toContain('Game Over')
    
    // Now trigger the winning screen
    gameTestUtils.triggerWinningScreen(lobbyRef, {
      'player1': 10, // Winner
      'player2': 5
    })
    
    // Update the mock game context to reflect the complete state
    mockGameContext.isComplete.value = true
    mockGameContext.leaderboard.value = [
      { playerId: 'player1', points: 10 },
      { playerId: 'player2', points: 5 }
    ]
    
    // Wait for the component to update
    await wrapper.vm.$nextTick()
    
    // Now the winning screen should be displayed
    expect(wrapper.text()).toContain('Game Over')
    expect(wrapper.text()).toContain('Player 1')
    expect(wrapper.text()).toContain('10 points')
    expect(wrapper.text()).toContain('Player 2')
    expect(wrapper.text()).toContain('5 points')
  })

  it('demonstrates a simpler way to trigger the winning screen', async () => {
    // This example shows a more direct approach using the mock game context
    
    // Create a mock game context (initially not complete)
    const mockGameContext = gameTestUtils.createMockGameContext(false)
    
    // Mock the useGameContext to return our mock context
    vi.mocked(require('~/composables/useGameContext').useGameContext).mockReturnValue(mockGameContext)
    
    // Mount the GameBoard component with any lobby
    const wrapper = mount(GameBoard, {
      props: {
        lobby: gameTestUtils.createMockLobby().value,
        players: gameTestUtils.createMockPlayers()
      },
      global: {
        stubs: {
          'PlayerList': true,
          'BlackCardComponent': true,
          'whiteCard': true,
          'UserHand': true
        }
      }
    })
    
    // Initially, the winning screen should not be displayed
    expect(wrapper.text()).not.toContain('Game Over')
    
    // Directly update the game context to trigger the winning screen
    mockGameContext.isComplete.value = true
    mockGameContext.leaderboard.value = [
      { playerId: 'player1', points: 10 },
      { playerId: 'player2', points: 5 }
    ]
    
    // Wait for the component to update
    await wrapper.vm.$nextTick()
    
    // Now the winning screen should be displayed
    expect(wrapper.text()).toContain('Game Over')
    expect(wrapper.text()).toContain('Player 1')
    expect(wrapper.text()).toContain('10 points')
  })
})