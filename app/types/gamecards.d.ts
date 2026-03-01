import type { PlayerId, CardId } from "./game";

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

/**
 * Resolved card text entry — returned by /api/cards/resolve.
 * Populated once per gamecards fetch and keyed by card $id.
 */
export interface CardTextEntry {
  text: string;
  pack: string;
  /** Pick count — only populated for black cards (defaults to 1 when absent) */
  pick?: number;
}

/** Map of cardId → resolved text & pack, shared across GameTable and UserHand */
export type CardTexts = Record<CardId, CardTextEntry>;
