// composables/useGameEngine.ts
import { useAppwrite } from '~/composables/useAppwrite'
import type { Player } from '~/types/player'

interface GameState {
    phase: 'submitting' | 'judging' | 'reviewing'
    round: number
    judge: string
    blackCard: { id: string; text: string } | null
    playedCards: Record<string, string>
    hands: Record<string, string[]>
    scores: Record<string, number>
    whiteDeck: string[]
    blackDeck: string[]
}

const getAppwrite = () => {
    if (import.meta.server) throw new Error("useLobby() cannot be used during SSR");
    const {databases, account, client} = useAppwrite();
    if (!databases || !account) throw new Error("Appwrite not initialized");
    return {databases, account, client};
};

export const useGameEngine = () => {
    const {databases} = getAppwrite();
    const config = useRuntimeConfig()

    // Shuffle util
    function shuffle<T>(array: T[]): T[] {
        const copy = [...array]
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[copy[i], copy[j]] = [copy[j], copy[i]]
        }
        return copy
    }

    // Create the initial gameState for the first round
    const generateGameState = async (players: Player[]): Promise<GameState> => {
        const {databases} = getAppwrite();
        const whiteCards = await databases.listDocuments(
            config.public.appwriteDatabaseId,
            'white_cards'
        )
        const blackCards = await databases.listDocuments(
            config.public.appwriteDatabaseId,
            'black_cards'
        )

        const whiteDeck = shuffle(whiteCards.documents.map((c) => c.$id))
        const blackDeck = shuffle(blackCards.documents.map((c) => ({ id: c.$id, text: c.text })))

        const hands: Record<string, string[]> = {}
        for (const player of players) {
            hands[player.userId] = whiteDeck.splice(0, 7)
        }

        const judge = players[Math.floor(Math.random() * players.length)].userId

        return {
            phase: 'submitting',
            round: 1,
            judge,
            blackCard: blackDeck.shift() ?? null,
            playedCards: {},
            hands,
            scores: Object.fromEntries(players.map((p) => [p.userId, 0])),
            whiteDeck,
            blackDeck: blackDeck.map((c) => c.id),
        }
    }

    return {
        generateGameState
    }
}
