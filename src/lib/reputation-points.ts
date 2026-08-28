/** Leaderboard points only — not an asset. Nothing here is minted, sent, or held. */

export interface PointsBreakdown {
  base: number
  speedBonus: number
  photoBonus: number
  locationBonus: number
}

export function calculatePoints(opts: {
  withinHalfTimeWindow?: boolean
  hasPhotoProof?: boolean
  hasLocationProof?: boolean
}): PointsBreakdown {
  return {
    base: 10,
    speedBonus: opts.withinHalfTimeWindow ? 5 : 0,
    photoBonus: opts.hasPhotoProof ? 5 : 0,
    locationBonus: opts.hasLocationProof ? 5 : 0,
  }
}

export function totalPoints(breakdown: PointsBreakdown): number {
  return breakdown.base + breakdown.speedBonus + breakdown.photoBonus + breakdown.locationBonus
}
