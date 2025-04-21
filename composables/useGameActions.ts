// composables/useGameActions.ts
import { useAppwrite } from '~/composables/useAppwrite'
import { ID } from 'appwrite'

export function useGameActions() {
    const { functions } = useAppwrite()

    const startGame = (lobbyId: string) =>
        functions.createExecution('startGame', JSON.stringify({ lobbyId }))

    const submitCards = (lobbyId: string, playerId: string, cardIds: string[]) =>
        functions.createExecution('playCard', JSON.stringify({ lobbyId, playerId, cardIds }))

    const selectWinner = (lobbyId: string, winnerId: string) =>
        functions.createExecution('selectWinner', JSON.stringify({ lobbyId, winnerId }))

    return { startGame, submitCards, selectWinner }
}
