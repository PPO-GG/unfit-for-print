import { getAppwrite } from '~/utils/appwrite';
import { Query } from 'appwrite';
import type { Player } from '~/types/player';
import type { GameState } from '~/types/game';
import { getRandomInt } from '~/composables/useCrypto';


export const useGameEngine = () => {
    const { databases } = getAppwrite();
    const config = useRuntimeConfig();

    const shuffle = <T>(array: T[]): T[] => {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = getRandomInt(i + 1);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    const generateGameState = async (players: Player[]): Promise<GameState> => {
        // Get total count of white cards
        const whiteTotalRes = await databases.listDocuments(
            config.public.appwriteDatabaseId,
            config.public.appwriteWhiteCardCollectionId,
            [Query.limit(1)]
        );
        const whiteTotal = whiteTotalRes.total;

        // Get total count of black cards
        const blackTotalRes = await databases.listDocuments(
            config.public.appwriteDatabaseId,
            config.public.appwriteBlackCardCollectionId,
            [Query.limit(1)]
        );
        const blackTotal = blackTotalRes.total;

        // For black cards, we'll still use the offset approach since we need fewer
        const blackOffset = getRandomInt(Math.max(1, blackTotal - 20));
        const blackCards = await databases.listDocuments(
            config.public.appwriteDatabaseId,
            config.public.appwriteBlackCardCollectionId,
            [Query.offset(blackOffset), Query.limit(20)]
        );

        // Shuffle black cards
        const blackDeck = shuffle(
            blackCards.documents.map((c) => ({ id: c.$id, text: c.text, pick: c.pick }))
        );

        // Keep track of all cards that have been dealt to prevent duplicates
        const dealtCards = new Set<string>();

        // Function to fetch a single random white card that hasn't been dealt yet
        const fetchRandomWhiteCard = async (): Promise<string> => {
            let attempts = 0;
            let cardId: string;

            // Try up to 10 times to get a unique card
            while (attempts < 10) {
                const randomOffset = getRandomInt(whiteTotal);
                const card = await databases.listDocuments(
                    config.public.appwriteDatabaseId,
                    config.public.appwriteWhiteCardCollectionId,
                    [Query.limit(1), Query.offset(randomOffset)]
                );
                cardId = card.documents[0].$id;

                // If this card hasn't been dealt yet, use it
                if (!dealtCards.has(cardId)) {
                    dealtCards.add(cardId);
                    return cardId;
                }

                attempts++;
            }

            // If we couldn't find a unique card after 10 attempts, try a different approach
            // Get a batch of cards and find the first one that hasn't been dealt
            const batchSize = 50;
            const randomOffset = getRandomInt(Math.max(1, whiteTotal - batchSize));
            const cards = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwriteWhiteCardCollectionId,
                [Query.limit(batchSize), Query.offset(randomOffset)]
            );

            for (const card of cards.documents) {
                if (!dealtCards.has(card.$id)) {
                    dealtCards.add(card.$id);
                    return card.$id;
                }
            }

            // If we still couldn't find a unique card, log an error and return any card
            // This should be extremely rare
            console.warn('Could not find a unique card after multiple attempts');
            return cardId!;
        };

        // Deal 7 random cards to each player
        const hands: Record<string, string[]> = {};
        for (const player of players) {
            hands[player.userId] = [];
            for (let i = 0; i < 7; i++) {
                const cardId = await fetchRandomWhiteCard();
                hands[player.userId].push(cardId);
            }
        }

        // Create white deck with additional random cards
        const whiteDeck: string[] = [];
        for (let i = 0; i < 20; i++) {
            const cardId = await fetchRandomWhiteCard();
            whiteDeck.push(cardId);
        }

        const judgeId = players[getRandomInt(players.length)].userId;

        return {
            phase: 'submitting',
            round: 1,
            judgeId,
            blackCard: blackDeck.shift() ?? null,
            playedCards: {},
            hands,
            scores: Object.fromEntries(players.map((p) => [p.userId, 0])),
            whiteDeck,
            blackDeck: blackDeck.map((c) => c.id),
            discardWhite: [],
            discardBlack: [],
            submissions: {},
            roundEndStartTime: null,
            returnedToLobby: {},
            gameEndTime: undefined,
            config: {
                maxPoints: 10,
                cardsPerPlayer: 10,
                cardPacks: [],
                isPrivate: false,
                lobbyName: 'New Game',
            },
        };
    };

    // Function to refill white card deck if it's running low
    const refillWhiteDeck = async (state: GameState): Promise<GameState> => {
        // If we have enough cards, no need to refill
        if (state.whiteDeck.length > 10) {
            return state;
        }

        // First, try to reuse discarded cards if available
        if (state.discardWhite.length > 0) {
            // Shuffle discarded cards and add them back to the deck
            const shuffledDiscards = shuffle([...state.discardWhite]);
            state.whiteDeck = [...state.whiteDeck, ...shuffledDiscards];
            state.discardWhite = [];
            return state;
        }

        // If no discarded cards or we still need more, fetch new ones from the database
        try {
            // Get total count of white cards
            const totalRes = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwriteWhiteCardCollectionId,
                [Query.limit(1)]
            );
            const total = totalRes.total;

            // How many cards to fetch
            const cardsToFetch = 30;

            // Function to fetch a single random white card
            const fetchRandomWhiteCard = async (): Promise<string> => {
                const randomOffset = getRandomInt(total);
                const card = await databases.listDocuments(
                    config.public.appwriteDatabaseId,
                    config.public.appwriteWhiteCardCollectionId,
                    [Query.limit(1), Query.offset(randomOffset)]
                );
                return card.documents[0].$id;
            };

            // Fetch individual random cards
            const newCards: string[] = [];
            for (let i = 0; i < cardsToFetch; i++) {
                const cardId = await fetchRandomWhiteCard();
                newCards.push(cardId);
            }

            // Add new cards to the deck and shuffle
            state.whiteDeck = shuffle([...state.whiteDeck, ...newCards]);
            return state;
        } catch (error) {
            console.error('Failed to refill white deck:', error);
            return state;
        }
    };

    // Function to refill black card deck if it's running low
    const refillBlackDeck = async (state: GameState): Promise<GameState> => {
        // If we have enough cards, no need to refill
        if (state.blackDeck.length > 5) {
            return state;
        }

        // First, try to reuse discarded cards if available
        if (state.discardBlack.length > 0) {
            // Shuffle discarded cards and add them back to the deck
            const shuffledDiscards = shuffle([...state.discardBlack]);
            state.blackDeck = [...state.blackDeck, ...shuffledDiscards];
            state.discardBlack = [];
            return state;
        }

        try {
            // Get total count of black cards
            const totalRes = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwriteBlackCardCollectionId,
                [Query.limit(1)]
            );
            const total = totalRes.total;

            // How many cards to fetch
            const cardsToFetch = 20;

            // Generate random offset based on total cards available
            const offset = getRandomInt(Math.max(1, total - cardsToFetch));

            // Fetch random cards
            const blackCards = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwriteBlackCardCollectionId,
                [Query.limit(cardsToFetch), Query.offset(offset)]
            );

            // Add new cards to the deck and shuffle
            const newCards = blackCards.documents.map((c) => ({ id: c.$id, text: c.text, pick: c.pick }));
            const newCardIds = newCards.map(c => c.id);
            state.blackDeck = shuffle([...state.blackDeck, ...newCardIds]);
            return state;
        } catch (error) {
            console.error('Failed to refill black deck:', error);
            return state;
        }
    };

    // Function to handle discarded cards
    const discardSubmittedCards = (state: GameState): GameState => {
        // Get all submitted card IDs
        const allSubmittedCards: string[] = [];
        Object.values(state.submissions).forEach(cards => {
            allSubmittedCards.push(...cards);
        });

        // Add submitted cards to discard pile
        state.discardWhite = [...state.discardWhite, ...allSubmittedCards];

        // Clear submitted cards
        state.submissions = {};

        return state;
    };

    return {
        generateGameState,
        refillWhiteDeck,
        refillBlackDeck,
        discardSubmittedCards,
        shuffle,
    };
};
