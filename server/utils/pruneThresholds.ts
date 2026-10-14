// Shared by pruneLobbies and the admin monitor's housekeeping view, so the
// counts the monitor shows are the lobbies a prune will actually remove.
export const DEFAULT_ORPHAN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const DEFAULT_COMPLETED_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour
export const GUEST_ORPHAN_TTL_MS = 15 * 60 * 1000; // 15 minutes
