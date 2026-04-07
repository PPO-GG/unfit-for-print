import type { Player } from '~/types/player.d'

/**
 * Extracts the Discord user ID from a player's avatar URL or legacy hash.
 * Returns null for non-Discord players or players with no avatar.
 *
 * URL format:  https://cdn.discordapp.com/avatars/{discordId}/{hash}.png
 * Legacy format: discordId/hash
 */
export function getDiscordIdFromPlayer(player: Pick<Player, 'provider' | 'avatar'>): string | null {
  if (player.provider !== 'discord' || !player.avatar) return null
  if (player.avatar.startsWith('http')) {
    // ['https:', '', 'cdn.discordapp.com', 'avatars', '{discordId}', '{hash}.png']
    return player.avatar.split('/')[4] ?? null
  }
  return player.avatar.split('/')[0] ?? null
}
