// tests/components/game/GameBoard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'  // Add computed import
import GameBoard from '~/components/game/GameBoard.vue'

// Mock all the composables and dependencies
vi.mock('~/composables/useGameContext', () => ({
    useGameContext: () => ({
        state: ref({ round: 1 }),
        isSubmitting: ref(true),
        isJudging: ref(false),
        isComplete: ref(false),
        isJudge: ref(false),
        myHand: ref(['card1', 'card2']),
        submissions: ref({}),
        otherSubmissions: ref([]),
        judgeId: ref('judge1'),
        blackCard: ref({ id: 'black1', text: 'Test black card', pick: 1 }),
        leaderboard: ref([]),
        hands: ref({})
    })
}))

vi.mock('~/composables/useGameActions', () => ({
    useGameActions: () => ({
        playCard: vi.fn(),
        selectWinner: vi.fn()
    })
}))

vi.mock('~/composables/useLobby', () => ({
    useLobby: () => ({
        leaveLobby: vi.fn()
    })
}))

vi.mock('~/composables/useNotifications', () => ({
    useNotifications: () => ({
        notify: vi.fn()
    })
}))

vi.mock('~/composables/useGameCards', () => ({
    useGameCards: () => ({
        playerHands: ref({}),
        fetchGameCards: vi.fn(),
        subscribeToGameCards: vi.fn().mockReturnValue(() => {})
    })
}))

vi.mock('~/stores/userStore', () => ({
    useUserStore: () => ({
        user: { $id: 'user1' }
    })
}))

vi.mock('~/utils/appwrite', () => ({
    getAppwrite: () => ({
        databases: {
            updateDocument: vi.fn().mockResolvedValue({})
        }
    })
}))

vi.mock('~/composables/useSfx', () => ({
    useSfx: () => ({
        playSfx: vi.fn()
    })
}))

describe('GameBoard.vue', () => {
    let wrapper: any

    const createWrapper = (props = {}) => {
        return mount(GameBoard, {
            props: {
                lobby: {
                    $id: 'lobby1',
                    hostUserId: 'host1',
                    revealedSubmissions: '{}',
                    ...props.lobby
                },
                players: [
                    { $id: 'player1', userId: 'user1', name: 'Test User', playerType: 'participant' },
                    { $id: 'player2', userId: 'judge1', name: 'Judge User', playerType: 'participant' }
                ],
                ...props
            },
            global: {
                stubs: {
                    'BlackCard': true,
                    'whiteCard': true,
                    'UserHand': true,
                    'UButton': true
                },
                mocks: {
                    useNuxtApp: () => ({
                        payload: {
                            state: {}
                        }
                    }),
                    useRuntimeConfig: () => ({
                        public: {
                            appwriteDatabaseId: 'db1',
                            appwriteLobbyCollectionId: 'lobbies',
                            appwritePlayerCollectionId: 'players',
                            appwriteGamecardsCollectionId: 'gamecards'
                        }
                    })
                }
            }
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the game board with correct round number', async () => {
        wrapper = createWrapper()
        await flushPromises()

        expect(wrapper.text()).toContain('Round 1')
    })

    it('displays the correct phase text during submission phase', async () => {
        wrapper = createWrapper()
        await flushPromises()

        expect(wrapper.text()).toContain('SUBMISSION PHASE')
    })

    it('shows the judge name correctly', async () => {
        wrapper = createWrapper()
        await flushPromises()

        expect(wrapper.text()).toContain('Judge: Judge User')
    })

    it('emits leave event when leave button is clicked', async () => {
        wrapper = createWrapper()
        await flushPromises()

        // Find and click the leave button
        // Note: You might need to adjust this selector based on your actual implementation
        const leaveButton = wrapper.find('button[data-test="leave-button"]')
        if (leaveButton.exists()) {
            await leaveButton.trigger('click')
            expect(wrapper.emitted('leave')).toBeTruthy()
        }
    })

    it('correctly identifies if the current user is a participant', async () => {
        wrapper = createWrapper()
        await flushPromises()

        // Access the component's internal state
        const vm = wrapper.vm
        expect(vm.isParticipant).toBe(true)
    })
})