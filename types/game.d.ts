type PlayerId      = string;   // Appwrite user ID
type CardId        = string;   // Appwrite card document ID

export interface GameState {
    phase: 'waiting' | 'submitting' | 'judging' | 'roundEnd' | 'complete';
    czarId: PlayerId | null;
    blackCard: { id: CardId; text: string; pick: number } | null;
    playedCards: Record<string, string>;
    submissions: Record<PlayerId, CardId[]>;
    hands: Record<PlayerId, CardId[]>;
    whiteDeck: CardId[];
    blackDeck: CardId[];
    discardWhite: CardId[];
    discardBlack: CardId[];
    scores: Record<PlayerId, number>;
    round: number;
}