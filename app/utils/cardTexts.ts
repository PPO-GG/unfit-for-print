// utils/cardTexts.ts
// The single definition of how card texts are read out of the Y.Doc "cards" map.
//
// Texts can arrive under two key shapes and BOTH must be merged, chunks first:
//   - cardTexts_0…N (+ cardTextsChunks) — written by startGame, split to stay
//     under Teleportal's ~64KB per-update limit
//   - cardTexts — the flat key
//
// Every reader must use this helper. When the chunked and flat keys were read
// as either/or by one reader and merged by another, replenished cards rendered
// blank in UserHand while the judging table looked fine.

import type { CardTexts } from "~/types/gamecards";
import type { CardId, GameState } from "~/types/game";

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Merges every card-text key of a raw Y.Map("cards") snapshot into one object.
 *
 * @param raw - the cards map as a plain object (Object.fromEntries(map.entries()))
 */
export function mergeCardTextKeys(raw: Record<string, any>): CardTexts {
  const merged: CardTexts = {};
  const numChunks = parseInt(raw.cardTextsChunks || "0", 10);
  for (let i = 0; i < numChunks; i++) {
    Object.assign(merged, safeParseJson(raw[`cardTexts_${i}`], {}));
  }
  Object.assign(merged, safeParseJson(raw.cardTexts, {}));
  return merged;
}

/**
 * The WHITE card ids this client can actually put on screen: its own hand,
 * every submitted card (the judging table renders all of them), and the
 * winning cards.
 *
 * This is the set useCardTexts resolves — deliberately far smaller than the
 * whole deck, which is the point of resolving on demand instead of shipping
 * every text through the Y.Doc.
 *
 * The black card is deliberately NOT here: /api/cards/resolve queries one
 * table per call, so it is passed separately as a black id.
 */
export function collectVisibleCardIds(
  state: GameState | null | undefined,
  myHand: CardId[] | null | undefined,
): CardId[] {
  const ids = new Set<CardId>();

  for (const id of myHand ?? []) if (id) ids.add(id);

  if (state) {
    for (const submitted of Object.values(state.submissions ?? {})) {
      for (const id of submitted ?? []) if (id) ids.add(id);
    }
    for (const id of state.winningCards ?? []) if (id) ids.add(id);
  }

  return [...ids];
}

/**
 * Returns the game state with the black card's `text` (and `pack`) filled in
 * from resolved card texts, so components can keep reading `blackCard.text`.
 *
 * An embedded text always wins: that covers both the exhausted-deck sentinel,
 * which has no card id to resolve from, and docs created before card texts
 * left the Y.Doc.
 */
export function withResolvedBlackText<T extends GameState | null | undefined>(
  state: T,
  cardTexts: CardTexts,
): T {
  if (!state?.blackCard) return state;

  const { blackCard } = state;
  if (blackCard.text) return state;

  const resolved = cardTexts[blackCard.id];
  return {
    ...state,
    blackCard: {
      ...blackCard,
      text: resolved?.text ?? "",
      pack: blackCard.pack ?? resolved?.pack ?? "",
    },
  };
}
