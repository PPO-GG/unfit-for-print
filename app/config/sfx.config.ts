/**
 * Centralized SFX registry.
 *
 * Every sound used in the app lives here so swapping files,
 * adjusting defaults, or adding new sounds is a one-file change.
 *
 * Usage (individual files):
 *   import { SFX } from "~/config/sfx.config";
 *   playSfx(SFX.cardSelect, { volume: 0.8 });
 *
 * Usage (sprites):
 *   import { SPRITES } from "~/config/sfx.config";
 *   const { playSfx } = useSfx(SPRITES.game.src, SPRITES.game.map);
 *   playSfx("", { id: "cardLand" });  // play a specific sprite
 *   playSfx("");                       // play a random sprite from the map
 */

const BASE = "/sounds/sfx";

// ── Helpers ─────────────────────────────────────────────────────
/** Shorthand to build a path array for randomised variants. */
const variants = (name: string, count: number, ext = "wav"): string[] =>
  Array.from({ length: count }, (_, i) => `${BASE}/${name}${i + 1}.${ext}`);

// ═══════════════════════════════════════════════════════════════
// Individual SFX files
// ═══════════════════════════════════════════════════════════════
export const SFX = {
  // ── Card interactions (hand) ───────────────────────────────
  /** Card hover in hand (random variant) */
  cardHover: variants("hover", 4),
  /** Card select / deselect in hand (random variant) */
  cardSelect: variants("cardSelect", 3),
  /** Card flip / reveal (random variant) */
  cardFlip: variants("flip", 3),

  // ── Card movement ──────────────────────────────────────────
  /** Player submits / throws card(s) from hand */
  cardThrow: `${BASE}/submit.wav`,
  /** Card shuffle (random variant) */
  cardShuffle: variants("shuffle", 2),

  // ── Game events ────────────────────────────────────────────
  /** Winner is selected */
  selectWinner: `${BASE}/selectWinner.wav`,
  /** Player joins lobby */
  playerJoin: `${BASE}/playerJoin.wav`,

  // ── UI / general ───────────────────────────────────────────
  /** Generic click */
  click: `${BASE}/click1.wav`,

  // ── Chat ───────────────────────────────────────────────────
  /** Outgoing chat message */
  chatSend: `${BASE}/chatSend.wav`,
  /** Incoming chat message */
  chatReceive: `${BASE}/chatReceive.wav`,

  // ── Placeholder slots for future individual SFX ────────────
  // Uncomment and point to files once you have them:
  //
  // /** Card lands on the table pile */
  // cardLand: `${BASE}/cardLand.wav`,
  // /** Phase transition: submitting → judging */
  // phaseJudging: `${BASE}/phaseJudging.wav`,
  // /** All cards FLIP-settled into row, judging ready */
  // judgingReady: `${BASE}/judgingReady.wav`,
  // /** Winner celebration / fanfare */
  // celebration: `${BASE}/celebration.wav`,
  // /** New hand dealt to player */
  // dealCards: `${BASE}/dealCards.wav`,
  // /** Next round starts */
  // nextRound: `${BASE}/nextRound.wav`,
} as const;

// ═══════════════════════════════════════════════════════════════
// Audio Sprites
// ═══════════════════════════════════════════════════════════════
//
// A sprite is a single audio file containing multiple sounds
// packed end-to-end. Each entry in the `map` describes where
// a sound starts and how long it lasts (both in milliseconds).
//
// To create a sprite:
//   1. Combine your WAV/MP3 files into one file (e.g. with Audacity
//      or ffmpeg: `ffmpeg -i "concat:a.wav|b.wav" sprite.wav`)
//   2. Note the start time and duration of each segment in ms
//   3. Add an entry below
//
// Usage:
//   const { playSfx } = useSfx(SPRITES.game.src, SPRITES.game.map);
//   playSfx("", { id: "cardLand" });   // play specific sound
//   playSfx("");                        // play random from map
//

export interface SpriteDefinition {
  /** Path to the combined audio file */
  src: string;
  /** Map of sprite name → [startMs, durationMs] */
  map: Record<string, [startMs: number, durationMs: number]>;
}

export const SPRITES = {
  // ── Example: game sprite ──────────────────────────────────
  // Uncomment and fill in when you have a sprite file:
  //
  cardLand: {
    src: `${BASE}/cardLand.wav`,
    map: {
      cardLand1: [12, 34], //   46 - 12
      cardLand2: [243, 27], //  270 - 243
      cardLand3: [463, 62], //  525 - 463
      cardLand4: [700, 20], //  720 - 700
      cardLand5: [944, 37], //  981 - 944
      cardLand6: [1187, 47], // 1234 - 1187
      cardLand7: [1453, 26], // 1479 - 1453
      cardLand8: [1729, 35], // 1764 - 1729
      cardLand9: [1957, 30], // 1987 - 1957
    },
  } satisfies SpriteDefinition,
} as const;

/** Type-safe key for any registered individual sound. */
export type SfxKey = keyof typeof SFX;

/** Type-safe key for any registered sprite. */
export type SpriteKey = keyof typeof SPRITES;
