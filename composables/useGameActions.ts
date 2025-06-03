// composables/useGameActions.ts
import {useAppwrite} from '~/composables/useAppwrite'

export function useGameActions() {
    const { functions } = useAppwrite()
    const config = useRuntimeConfig()
    const FUNCTIONS: Record<'START_GAME' | 'PLAY_CARD' | 'SELECT_WINNER' | 'START_NEXT_ROUND', string> = {
        START_GAME: config.public.appwriteFunctionsStartGame as string,
        PLAY_CARD: config.public.appwriteFunctionsPlayCard as string,
        SELECT_WINNER: config.public.appwriteFunctionsSelectWinner as string,
        START_NEXT_ROUND: config.public.appwriteFunctionsStartNextRound as string,
    };

    const startGame = async (payload: string) => {
        try {
            return await functions.createExecution(
                FUNCTIONS.START_GAME,
                payload,
                false
            );
        } catch (error) {
            console.error('Error in startGame:', error);
            throw error;
        }
    };

    const playCard = async (lobbyId: string, playerId: string, cardIds: string[]) => {
        try {
            return await functions.createExecution(FUNCTIONS.PLAY_CARD, JSON.stringify({lobbyId, playerId, cardIds}))
        } catch (error) {
            console.error('Error in playCard:', error)
            throw error
        }
    }

    const selectWinner = async (lobbyId: string, winnerId: string) => {
        try {
            return await functions.createExecution(FUNCTIONS.SELECT_WINNER, JSON.stringify({lobbyId, winnerId}))
        } catch (error) {
            console.error('Error in selectWinner:', error)
            throw error
        }
    }

    const startNextRound = async (lobbyId: string, documentId?: string) => {
        try {
            return await functions.createExecution(FUNCTIONS.START_NEXT_ROUND, JSON.stringify({lobbyId, documentId}))
        } catch (error) {
            console.error('Error in startNextRound:', error)
            throw error
        }
    }

    return { startGame, playCard, selectWinner, startNextRound }
}
