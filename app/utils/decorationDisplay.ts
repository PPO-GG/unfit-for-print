/** Number of ◆ pips to render for each rarity tier */
export function rarityPips(rarity: string): number {
  switch (rarity) {
    case 'legendary': return 4
    case 'epic':      return 3
    case 'rare':      return 2
    default:          return 1
  }
}

/** Tailwind text-color class for a rarity value */
export function rarityColorClass(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'text-amber-400'
    case 'epic':      return 'text-purple-400'
    case 'rare':      return 'text-blue-400'
    default:          return 'text-slate-400'
  }
}

/** Iconify icon name for a decoration category */
export function categoryIcon(category: string): string {
  switch (category) {
    case 'hat':    return 'i-solar-hat-bold'
    case 'face':   return 'i-solar-glasses-bold'
    case 'effect': return 'i-solar-stars-bold'
    default:       return 'i-solar-magic-stick-bold'
  }
}
