// composables/useGameActions.ts
import {useAppwrite} from '~/composables/useAppwrite'

export function useGameActions() {
    const appwrite = useAppwrite();
    const { functions } = appwrite;
    const config = useRuntimeConfig();

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
        if (!lobbyId) {
            console.error('startNextRound called with no lobbyId');
            throw new Error('No lobbyId provided to startNextRound');
        }

        if (!FUNCTIONS.START_NEXT_ROUND) {
            console.error('START_NEXT_ROUND function ID is not defined');
            throw new Error('START_NEXT_ROUND function ID is not defined');
        }

        try {
            const payload = JSON.stringify({
                lobbyId: lobbyId.toString(), // Ensure lobbyId is a string
                documentId: documentId?.toString() // Ensure documentId is a string if present
            });

            // Check if functions object is available
            if (!functions || typeof functions.createExecution !== 'function') {
                console.error('functions object or createExecution method is not available:', functions);
                throw new Error('Appwrite functions not available');
            }

            const result = await functions.createExecution(
                FUNCTIONS.START_NEXT_ROUND,
                payload,
                false // Set to false to ensure we get a response
            );

            // Proper response validation
            if (result && result.status === 'completed') {
                return {
                    success: true,
                    $id: result.$id,
                    status: result.status
                };
            } else {
                console.warn('Function execution completed but with unexpected status:', result?.status);
                return {
                    success: false,
                    status: result?.status || 'unknown',
                    error: 'Function execution failed'
                };
            }
        } catch (error) {
            console.error('Error in startNextRound:', error);
            throw error;
        }
    }

    return { startGame, playCard, selectWinner, startNextRound }
}
