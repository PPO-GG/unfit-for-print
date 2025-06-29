import { describe, it, expect } from 'vitest'
import { determineNextJudge } from '../../functions/startNextRound/src/main.js'

describe('determineNextJudge', () => {
  const order = ['p1','p2','p3']
  const players = [
    { userId: 'p1', afk: false, playerType: 'player' },
    { userId: 'p2', afk: true, playerType: 'player' },
    { userId: 'p3', afk: false, playerType: 'spectator' }
  ]

  it('skips AFK and spectator players when selecting next judge', () => {
    const next = determineNextJudge('p1', order, players)
    expect(next).toBe('p1')
  })

  it('cycles to first eligible player if current judge is AFK', () => {
    const next = determineNextJudge('p2', order, players)
    expect(next).toBe('p1')
  })
})
