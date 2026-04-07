import { describe, it, expect } from 'vitest'
import { getDiscordIdFromPlayer } from '~/utils/discord'

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
