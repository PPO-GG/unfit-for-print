export type PlayerId = string;
export type CardId = string;

// Core game state stored in the lobby document
export interface GameState {
  phase:
    | "waiting"
    | "submitting"
    | "submitting-complete"
    | "judging"
    | "roundEnd"
    | "complete";
  judgeId: PlayerId | null;
  players?: Record<string, string>;
  blackCard: {
    id: CardId;
    text: string;
    pick: number;
    pack?: string;
    /** Pack labelling for the card footer; filled in by withResolvedBlackText. */
    packDisplayName?: string | null;
    packSeries?: string | null;
  } | null;
  submissions: Record<PlayerId, CardId[]>;
  scores: Record<PlayerId, number>;
  round: number;
  roundWinner?: PlayerId;
  winningCards?: CardId[];
  roundEndStartTime: number | null;
  returnedToLobby?: Record<PlayerId, boolean>;
  skippedPlayers?: PlayerId[];
  revealedCards?: Record<PlayerId, boolean>;
  /** Ephemeral TTS text set by the judge — all clients read it aloud then clear it. */
  readAloudText?: string;
  /** Bumped whenever a new prompt reaches the table — by nextRound and by a
   *  judge's skip. Absent on docs created before black-card skipping shipped. */
  promptSerial?: number;
  /** Whether the judge has already used their one skip this round. */
  blackSkipUsed?: boolean;
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
