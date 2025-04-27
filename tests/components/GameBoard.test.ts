import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import GameBoard from '~/components/game/GameBoard.vue'

// Mock the composables
vi.mock('~/composables/useGameContext', () => ({
  useGameContext: vi.fn(() => ({
    state: ref({}),
    isWaiting: ref(false),
    isSubmitting: ref(false),
    isPlaying: ref(true),
    isJudging: ref(false),
    isComplete: ref(false),
    judgeId: ref(null),
    isCzar: ref(false),
    blackCard: ref(null),
    submissions: ref({}),
    mySubmission: ref(null),
    otherSubmissions: ref([]),
    hands: ref({}),
    myHand: ref([]),
    scores: ref({}),
    leaderboard: ref([])
  }))
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

describe('GameBoard.vue', () => {
  let wrapper: any
  let mockGameContext: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Default mock implementation
    mockGameContext = {
      state: ref({}),
      isWaiting: ref(false),
      isSubmitting: ref(false),
      isPlaying: ref(true),
      isJudging: ref(false),
      isComplete: ref(false),
      judgeId: ref(null),
      isCzar: ref(false),
      blackCard: ref(null),
      submissions: ref({}),
      mySubmission: ref(null),
      otherSubmissions: ref([]),
      hands: ref({}),
      myHand: ref([]),
      scores: ref({}),
      leaderboard: ref([])
    }
    
    // Update the mock implementation
    vi.mocked(require('~/composables/useGameContext').useGameContext).mockReturnValue(mockGameContext)
  })

  it('should display the winning screen when game is complete', async () => {
    // Set up the game state to be complete
    mockGameContext.isComplete.value = true
    mockGameContext.leaderboard.value = [
      { playerId: 'player1', points: 10 },
      { playerId: 'player2', points: 5 }
    ]
    
    // Mount the component with required props
    wrapper = mount(GameBoard, {
      props: {
        lobby: {
          $id: 'test-lobby',
          hostUserId: 'host-user',
          status: 'playing',
          gameState: JSON.stringify({ phase: 'complete' })
        },
        players: [
          { $id: 'player1', name: 'Player 1' },
          { $id: 'player2', name: 'Player 2' }
        ]
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
    
    // Check that the winning screen is displayed
    expect(wrapper.text()).toContain('Game Over')
    expect(wrapper.text()).toContain('Player 1')
    expect(wrapper.text()).toContain('10 points')
    expect(wrapper.text()).toContain('Player 2')
    expect(wrapper.text()).toContain('5 points')
  })

  // Test to trigger the winning screen programmatically
  it('should allow programmatically triggering the winning screen', async () => {
    // Mount with game not complete
    mockGameContext.isComplete.value = false
    
    wrapper = mount(GameBoard, {
      props: {
        lobby: {
          $id: 'test-lobby',
          hostUserId: 'host-user',
          status: 'playing',
          gameState: JSON.stringify({ phase: 'judging' })
        },
        players: [
          { $id: 'player1', name: 'Player 1' },
          { $id: 'player2', name: 'Player 2' }
        ]
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
    
    // Programmatically trigger the winning screen
    mockGameContext.isComplete.value = true
    mockGameContext.leaderboard.value = [
      { playerId: 'player1', points: 10 },
      { playerId: 'player2', points: 5 }
    ]
    
    await wrapper.vm.$nextTick()
    
    // Now the winning screen should be displayed
    expect(wrapper.text()).toContain('Game Over')
    expect(wrapper.text()).toContain('Player 1')
    expect(wrapper.text()).toContain('10 points')
  })
})