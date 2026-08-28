export type Tier = 'rookie' | 'bronze' | 'silver' | 'gold'

export interface TierInfo {
  tier: Tier
  name: string
  minCorrect: number
  avatarUnlocked: boolean
}

export const TIERS: TierInfo[] = [
  { tier: 'gold', name: 'Gold', minCorrect: 40, avatarUnlocked: true },
  { tier: 'silver', name: 'Silver', minCorrect: 15, avatarUnlocked: false },
  { tier: 'bronze', name: 'Bronze', minCorrect: 5, avatarUnlocked: false },
  { tier: 'rookie', name: 'Rookie', minCorrect: 0, avatarUnlocked: false },
]

export function tierFor(correct: number): TierInfo {
  return TIERS.find((t) => correct >= t.minCorrect) ?? TIERS[TIERS.length - 1]
}
