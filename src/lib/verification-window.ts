/**
 * Default window a verification round stays open for answers before it's
 * considered full/closed (see verification-rounds.ts). Used by the headless
 * agent-action API (no human picks a duration there) and as the fallback if
 * a UI request omits `windowSeconds`. Also drives the "answered within half
 * the window" reputation speed bonus.
 */
export const VERIFICATION_WINDOW_SECONDS = 90

/** Durations an asker can pick from on the human ask flow. */
export const WINDOW_PRESETS = [
  { label: '10 minutes', seconds: 10 * 60 },
  { label: '1 day', seconds: 24 * 60 * 60 },
  { label: '10 days', seconds: 10 * 24 * 60 * 60 },
] as const

export function isValidWindowSeconds(seconds: unknown): seconds is number {
  return typeof seconds === 'number' && WINDOW_PRESETS.some((p) => p.seconds === seconds)
}
