// tests/composables/useGameActions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Create a spy for the createExecution function
const createExecutionSpy = vi.fn().mockResolvedValue({ $id: 'exec1' })

// Mock the useAppwrite composable before importing useGameActions
vi.mock('~/composables/useAppwrite', () => ({
    useAppwrite: () => ({
        functions: {
            createExecution: createExecutionSpy
        }
    })
}))

// Now import useGameActions
import { useGameActions } from '~/composables/useGameActions'

// Mock the Nuxt runtime config
vi.mock('#imports', () => ({
    useRuntimeConfig: () => ({
        public: {
            appwriteDatabaseId: 'db1',
            appwriteLobbyCollectionId: 'lobbies',
            appwriteGamecardsCollectionId: 'gamecards'
        }
    })
}))

describe('useGameActions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('playCard calls the correct Appwrite functions', async () => {
        const { playCard } = useGameActions()

        await playCard('lobby1', 'user1', ['card1', 'card2'])

        // Check if the correct Appwrite function was called
        expect(createExecutionSpy).toHaveBeenCalledWith(
            '6807155e000e80388d6a', // PLAY_CARD function ID
            JSON.stringify({
                lobbyId: 'lobby1',
                playerId: 'user1',
                cardIds: ['card1', 'card2']
            })
        )
    })

    it('selectWinner calls the correct Appwrite functions', async () => {
        const { selectWinner } = useGameActions()

        await selectWinner('lobby1', 'winner1')

        // Check if the correct Appwrite function was called
        expect(createExecutionSpy).toHaveBeenCalledWith(
            '680715ac001101e8038f', // SELECT_WINNER function ID
            JSON.stringify({
                lobbyId: 'lobby1',
                winnerId: 'winner1'
            })
        )
    })
})