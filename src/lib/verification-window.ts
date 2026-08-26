/**
 * How long a verification request stays open before the UI gives up.
 * Shared between the client countdown (trustsaur-feature.tsx) and the
 * server-side "answered within half the window" $PURR bonus
 * (telegram-verifier.ts) so the two can't drift apart.
 */
export const VERIFICATION_WINDOW_SECONDS = 90
