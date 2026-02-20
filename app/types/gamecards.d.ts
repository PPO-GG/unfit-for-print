import type { PlayerId, CardId } from './game';

// Keep this interface for type safety when working with parsed data
export interface PlayerHand {
    playerId: PlayerId;
    cards: CardId[];
}

export interface GameCards {
    lobbyId: string;
    whiteDeck: CardId[];
    blackDeck: CardId[];
    discardWhite: CardId[];
    discardBlack: CardId[];
    playerHands: string[];
}
