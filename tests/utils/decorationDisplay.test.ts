import { describe, it, expect } from 'vitest'
import {
  rarityPips,
  rarityColorClass,
  categoryIcon,
} from '~/utils/decorationDisplay'

describe('rarityPips', () => {
  it('returns 1 for common', () => expect(rarityPips('common')).toBe(1))
  it('returns 2 for rare', () => expect(rarityPips('rare')).toBe(2))
  it('returns 3 for epic', () => expect(rarityPips('epic')).toBe(3))
  it('returns 4 for legendary', () => expect(rarityPips('legendary')).toBe(4))
  it('returns 1 for unknown value', () => expect(rarityPips('unknown')).toBe(1))
})

describe('rarityColorClass', () => {
  it('returns amber class for legendary', () =>
    expect(rarityColorClass('legendary')).toBe('text-amber-400'))
  it('returns purple class for epic', () =>
    expect(rarityColorClass('epic')).toBe('text-purple-400'))
  it('returns blue class for rare', () =>
    expect(rarityColorClass('rare')).toBe('text-blue-400'))
  it('returns slate class for common', () =>
    expect(rarityColorClass('common')).toBe('text-slate-400'))
  it('returns slate class for unknown', () =>
    expect(rarityColorClass('unknown')).toBe('text-slate-400'))
})

describe('categoryIcon', () => {
  it('returns hat icon', () =>
    expect(categoryIcon('hat')).toBe('i-solar-hat-bold'))
  it('returns glasses icon for face', () =>
    expect(categoryIcon('face')).toBe('i-solar-glasses-bold'))
  it('returns stars icon for effect', () =>
    expect(categoryIcon('effect')).toBe('i-solar-stars-bold'))
  it('returns magic-stick icon for custom', () =>
    expect(categoryIcon('custom')).toBe('i-solar-magic-stick-bold'))
  it('returns magic-stick icon for unknown', () =>
    expect(categoryIcon('unknown')).toBe('i-solar-magic-stick-bold'))
})
