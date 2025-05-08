export type PlayerId = string;   // Appwrite user ID
export type CardId = string;   // Appwrite card document ID

// Import GameCards interface from gamecards.d.ts to avoid duplication
import type { GameCards } from './gamecards';

// Core game state stored in the lobby document
export interface GameState {
    phase: 'waiting' | 'submitting' | 'judging' | 'roundEnd' | 'complete';
    judgeId: PlayerId | null;
    blackCard: { id: CardId; text: string; pick: number } | null;
    playedCards: Record<string, string>;
    submissions: Record<PlayerId, CardId[]>;
    scores: Record<PlayerId, number>;
    round: number;
    roundWinner?: PlayerId; // ID of the winner of the last round
    roundEndStartTime: number | null; // Server timestamp when roundEnd phase started
    returnedToLobby?: Record<PlayerId, boolean>; // Track which players have returned to the lobby
    gameEndTime?: number; // Timestamp when the game ended (for auto-return timer)

    // Newly added — now part of server-created game state
    config: {
        maxPoints: number;
        cardsPerPlayer: number;
        cardPacks: string[];
        isPrivate: boolean;
        lobbyName: string;
    };

    // Card-related properties that are managed separately in the GameCards collection
    // but temporarily stored in the state during processing
    whiteDeck: CardId[];
    hands: Record<PlayerId, CardId[]>;
    discardWhite: CardId[];
    discardBlack: CardId[];
}
