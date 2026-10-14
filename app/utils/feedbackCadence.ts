// How often the game-over rating prompt may appear on this device. Kept in
// localStorage rather than on the server: most players are guests with no
// identity worth keying on, and InstallPwaBanner already sets the precedent.
// Every access is wrapped — private windows, blocked storage and the Discord
// Activity iframe can all throw — and a failure reads as "never asked".

const DAY_MS = 24 * 60 * 60 * 1000;

export const RATED_KEY = "feedback-rated-at";
export const DISMISSED_KEY = "feedback-dismissed-at";
export const GAMES_KEY = "feedback-games-completed";

export const RATED_SUPPRESS_MS = 30 * DAY_MS;
export const DISMISSED_SUPPRESS_MS = 7 * DAY_MS;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the in-memory once-per-game guard still holds.
  }
}

/** A stored time only counts if it is in the past — a clock set backwards
 *  must not hide the prompt for a year. */
function within(key: string, windowMs: number, now: number): boolean {
  const at = Number(read(key));
  if (!Number.isFinite(at) || at <= 0) return false;
  const age = now - at;
  return age >= 0 && age < windowMs;
}

export function isPromptSuppressed(now: number = Date.now()): boolean {
  return (
    within(RATED_KEY, RATED_SUPPRESS_MS, now) ||
    within(DISMISSED_KEY, DISMISSED_SUPPRESS_MS, now)
  );
}

export function markRated(now: number = Date.now()): void {
  write(RATED_KEY, String(now));
}

export function markDismissed(now: number = Date.now()): void {
  write(DISMISSED_KEY, String(now));
}

export function readGamesCompleted(): number | null {
  const raw = read(GAMES_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function incrementGamesCompleted(): void {
  write(GAMES_KEY, String((readGamesCompleted() ?? 0) + 1));
}
