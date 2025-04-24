import { getAppwrite } from '~/utils/appwrite';
import type { Player } from '~/types/player';

interface GameState {
    phase: 'submitting' | 'judging' | 'reviewing';
    round: number;
    czarId: string;
    blackCard: { id: string; text: string } | null;
    playedCards: Record<string, string>;
    hands: Record<string, string[]>;
    scores: Record<string, number>;
    whiteDeck: string[];
    blackDeck: string[];
}

export const useGameEngine = () => {
    const { databases } = getAppwrite();
    const config = useRuntimeConfig();

    const shuffle = <T>(array: T[]): T[] => {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    const generateGameState = async (players: Player[]): Promise<GameState> => {
        const whiteCards = await databases.listDocuments(
            config.public.appwriteDatabaseId,
            config.public.appwriteWhiteCardCollectionId,
        );
        const blackCards = await databases.listDocuments(
            config.public.appwriteDatabaseId,
            config.public.appwriteBlackCardCollectionId,
        );

        const whiteDeck = shuffle(whiteCards.documents.map((c) => c.$id));
        const blackDeck = shuffle(
            blackCards.documents.map((c) => ({ id: c.$id, text: c.text }))
        );

        const hands: Record<string, string[]> = {};
        for (const player of players) {
            hands[player.userId] = whiteDeck.splice(0, 7);
        }

        const czarId = players[Math.floor(Math.random() * players.length)].userId;

        return {
            phase: 'submitting',
            round: 1,
            czarId,
            blackCard: blackDeck.shift() ?? null,
            playedCards: {},
            hands,
            scores: Object.fromEntries(players.map((p) => [p.userId, 0])),
            whiteDeck,
            blackDeck: blackDeck.map((c) => c.id),
        };
    };

    return {
        generateGameState,
    };
};
