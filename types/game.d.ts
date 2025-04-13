// types/game.d.ts
export interface GameState {
    phase: 'waiting' | 'submitting' | 'judging' | 'complete'
    round: number
    judge: string | null
    blackCard: { id: string; text: string } | null
    playedCards: Record<string, string> // userId → cardId
    hands: Record<string, string[]>     // userId → array of whiteCardIds
    scores: Record<string, number>      // userId → score
    players: Record<string, string>     // userId → username
    whiteDeck: string[]                 // shuffled whiteCardIds
    blackDeck: string[]                 // shuffled blackCardIds
}