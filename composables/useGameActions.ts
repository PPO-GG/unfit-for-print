// composables/useGameActions.ts
import { useAppwrite } from '~/composables/useAppwrite'

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
        console.log('Calling startGame with payload:', payload);

        try {
            // Convert payload to a JSON string (it's already a string in this case)
            const result = await functions.createExecution(
                FUNCTIONS.START_GAME,
                payload,
                false
            );
            console.log('startGame result:', result);
            return result;
        } catch (error) {
            console.error('Error in startGame:', error);
            throw error;
        }
    };

    const playCard = async (lobbyId: string, playerId: string, cardIds: string[]) => {
        console.log('Calling playCard with:', { lobbyId, playerId, cardIds })

        try {
            // Convert payload to a JSON string
            const result = await functions.createExecution(FUNCTIONS.PLAY_CARD, JSON.stringify({ lobbyId, playerId, cardIds }))
            console.log('playCard result:', result)
            return result
        } catch (error) {
            console.error('Error in playCard:', error)
            throw error
        }
    }

    const selectWinner = async (lobbyId: string, winnerId: string) => {
        console.log('Calling selectWinner with:', { lobbyId, winnerId })

        try {
            // Convert payload to a JSON string
            const result = await functions.createExecution(FUNCTIONS.SELECT_WINNER, JSON.stringify({ lobbyId, winnerId }))
            console.log('selectWinner result:', result)
            return result
        } catch (error) {
            console.error('Error in selectWinner:', error)
            throw error
        }
    }

    const startNextRound = async (lobbyId: string, documentId?: string) => {
        console.log('Calling startNextRound with lobbyId:', lobbyId, 'documentId:', documentId)

        try {
            // Convert payload to a JSON string
            const result = await functions.createExecution(FUNCTIONS.START_NEXT_ROUND, JSON.stringify({ lobbyId, documentId }))
            console.log('startNextRound result:', result)
            return result
        } catch (error) {
            console.error('Error in startNextRound:', error)
            throw error
        }
    }

    return { startGame, playCard, selectWinner, startNextRound }
}
