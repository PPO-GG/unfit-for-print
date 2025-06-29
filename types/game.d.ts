export type PlayerId = string;   // Appwrite user ID
export type CardId = string;   // Appwrite card document ID

// Core game state stored in the lobby document
export interface GameState {
    phase: 'waiting' | 'submitting' | 'judging' | 'roundEnd' | 'complete';
    judgeId: PlayerId | null;
    players?: Record<string, string>;
    blackCard: { id: CardId; text: string; pick: number } | null;
    playedCards: Record<string, string>;
    submissions: Record<PlayerId, CardId[]>;
    scores: Record<PlayerId, number>;
    round: number;
    roundWinner?: PlayerId;
    roundEndStartTime: number | null;
    submissionStartTime?: number;
    submissionCountdownDuration?: number;
    returnedToLobby?: Record<PlayerId, boolean>;
    gameEndTime?: number;

    config: {
        maxPoints: number;
        cardsPerPlayer: number;
        cardPacks: string[];
        isPrivate: boolean;
        lobbyName: string;
    };

    whiteDeck: CardId[];
    blackDeck: CardId[];
    hands: Record<PlayerId, CardId[]>;
    discardWhite: CardId[];
    discardBlack: CardId[];
}
