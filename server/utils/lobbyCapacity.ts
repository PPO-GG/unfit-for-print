// server/utils/lobbyCapacity.ts
//
// Seat limits for a lobby. Kept as constants rather than a per-lobby setting:
// these are protection against a lobby nobody can play in, not a knob hosts
// are meant to tune.

/**
 * Players and bots that may be seated as active participants.
 *
 * The round loop waits on every seated player to submit before judging, so a
 * lobby of forty is not a bigger game, it is a stalled one. `game/start` also
 * deals a full hand per player off one shuffled deck.
 *
 * Bots are additionally capped at 5 per lobby by `POST /api/bot/add`; this cap
 * covers players and bots together, so the practical ceiling is 20 seats of
 * which at most 5 are bots.
 */
export const MAX_ACTIVE_PLAYERS = 20;

/**
 * Total `players` rows a lobby will hold, spectators included.
 *
 * Spectators cost nothing in the round loop, so this is far looser than the
 * player cap — it exists so that holding a 4-character code is not a licence
 * to insert rows without end.
 */
export const MAX_LOBBY_SEATS = 50;
