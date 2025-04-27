// composables/useGameActions.ts
import { useAppwrite } from '~/composables/useAppwrite'

export function useGameActions() {
    const { functions } = useAppwrite()
    const FUNCTIONS = {
        START_GAME: '6807159b0034f2852a27',
        PLAY_CARD: '6807155e000e80388d6a',
        SELECT_WINNER: '680715ac001101e8038f',
        START_NEXT_ROUND: '680e7f88000abf0faa9d',
    }
    const startGame = (lobbyId: string) => {
        console.log('Calling startGame with lobbyId:', lobbyId)
        // Convert payload to a JSON string
        return functions.createExecution(FUNCTIONS.START_GAME, JSON.stringify({ lobbyId }))
    }

    const playCard = (lobbyId: string, playerId: string, cardIds: string[]) =>
        // Convert payload to a JSON string
        functions.createExecution(FUNCTIONS.PLAY_CARD, JSON.stringify({ lobbyId, playerId, cardIds }))

    const selectWinner = (lobbyId: string, winnerId: string) =>
        // Convert payload to a JSON string
        functions.createExecution(FUNCTIONS.SELECT_WINNER, JSON.stringify({ lobbyId, winnerId }))

    const startNextRound = (lobbyId: string) => {
        console.log('Calling startNextRound with lobbyId:', lobbyId)
        return functions.createExecution(FUNCTIONS.START_NEXT_ROUND, JSON.stringify({ lobbyId }))
    }

    return { startGame, playCard, selectWinner, startNextRound }
}
