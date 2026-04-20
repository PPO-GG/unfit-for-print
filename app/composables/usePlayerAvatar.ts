import type { Player } from "~/types/player";

/**
 * Resolve a displayable avatar URL for a player.
 *
 * Priority:
 *   1. Full URL stored on `player.avatar` (Discord/Google/DiceBear)
 *   2. Legacy Discord avatar hash — reconstruct CDN URL
 *   3. DiceBear fallback seeded by name (non-bot only)
 *   4. null (caller should render initials)
 */
export function getPlayerAvatarUrl(player: Player | null | undefined): string | null {
  if (!player?.avatar) {
    if (player && player.playerType !== "bot" && player.name) {
      return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(player.name)}`;
    }
    return null;
  }

  if (player.avatar.startsWith("http")) return player.avatar;

  if (player.provider === "discord") {
    const parts = player.avatar.split("/");
    if (parts.length === 2) {
      const [discordUserId, avatarHash] = parts;
      return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`;
    }
  }

  return null;
}
