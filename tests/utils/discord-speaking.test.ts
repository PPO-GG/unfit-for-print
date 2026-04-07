import { describe, it, expect } from 'vitest'

// Helper function with expected signature
// This will be extracted to a separate utility file in Step 4
function getDiscordIdFromPlayer(player: { provider: string; avatar: string }): string | null {
  if (player.provider !== 'discord' || !player.avatar) return null
  if (player.avatar.startsWith('http')) {
    // https://cdn.discordapp.com/avatars/{discordId}/{hash}.png
    // split: ['https:', '', 'cdn.discordapp.com', 'avatars', '{discordId}', '{hash}.png']
    return player.avatar.split('/')[4] ?? null
  }
  // Legacy format: "discordId/hash"
  return player.avatar.split('/')[0] ?? null
}

describe('getDiscordIdFromPlayer', () => {
  it('extracts Discord ID from full CDN avatar URL', () => {
    const player = {
      provider: 'discord',
      avatar: 'https://cdn.discordapp.com/avatars/123456789/abcdef.png',
    }
    expect(getDiscordIdFromPlayer(player)).toBe('123456789')
  })

  it('extracts Discord ID from legacy hash format', () => {
    const player = {
      provider: 'discord',
      avatar: '123456789/abcdef',
    }
    expect(getDiscordIdFromPlayer(player)).toBe('123456789')
  })

  it('returns null for non-discord provider', () => {
    const player = {
      provider: 'google',
      avatar: 'https://cdn.discordapp.com/avatars/123456789/abcdef.png',
    }
    expect(getDiscordIdFromPlayer(player)).toBeNull()
  })

  it('returns null for empty avatar', () => {
    const player = { provider: 'discord', avatar: '' }
    expect(getDiscordIdFromPlayer(player)).toBeNull()
  })
})
