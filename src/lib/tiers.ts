export type Tier = 'rookie' | 'bronze' | 'silver' | 'gold'

export interface TierInfo {
  tier: Tier
  name: string
  minPurr: number
  feeShare: number
  avatarUnlocked: boolean
}

// Ordered highest to lowest — tierFor() returns the first tier whose
// minPurr the balance clears. feeShare is read in the payout path so the
// unlock is a real economic effect, not just a label.
export const TIERS: TierInfo[] = [
  { tier: 'gold', name: 'Gold', minPurr: 200, feeShare: 0.95, avatarUnlocked: true },
  { tier: 'silver', name: 'Silver', minPurr: 50, feeShare: 0.85, avatarUnlocked: false },
  { tier: 'bronze', name: 'Bronze', minPurr: 10, feeShare: 0.7, avatarUnlocked: false },
  { tier: 'rookie', name: 'Rookie', minPurr: 0, feeShare: 0.7, avatarUnlocked: false },
]

export function tierFor(purrBalance: number): TierInfo {
  return TIERS.find((t) => purrBalance >= t.minPurr) ?? TIERS[TIERS.length - 1]
}
