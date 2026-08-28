# Trustact — No-Token Migration + Demo-Day Spec

**Paste this whole file into Cursor's agent chat** (or open it and say "follow
this spec top to bottom, ask me before section 4"). It's written as a task
list, in the order to execute.

## 0. Why this exists

Research pull from Colosseum's own hackathon database (5,428 projects, 293
winners) shows two things:

1. Trustact's actual mechanic — free to ask, verifiers stake real money,
   consensus resolves (no asker, no self-judging), platform takes a 10% cut
   only on a real majority — already matches what wins. This shipped in
   `f20b32d` and should **not** change.
2. The one thing dragging the project into a losing pattern is **`$PURR`**:
   a real SPL token minted per correct answer (`src/lib/purr-token.ts`),
   with a tier system (`src/lib/tiers.ts`) that names a `feeShare` unlocked
   by token balance. "Tokenized rewards" has a **0% win rate across every
   winner in the dataset.** "Token-gating" scores negative lift. Doesn't
   matter that `feeShare` isn't actually wired into the real payout split
   yet (it isn't — checked `round-payout.ts`, the split is flat and even)
   — the pitch and the UI both currently *read* as a reward-token app, and
   that's what's costing it.

This is pivot #4b in this project's research trail (see `PROJECT_BRIEF.md`
§Why this idea) — not a new pivot, a correction inside the current one.
**The fix is subtractive.** Nothing about the core product changes; you're
removing a token, not redesigning an app.

---

## 1. Non-negotiables — do not touch

- Free-to-ask. Never reintroduce an asker fee.
- Parimutuel staking + consensus resolution exactly as implemented in
  `computeConsensus()` (`src/lib/verification-rounds.ts`) — unanimous/tie/
  solo = push, real majority = redistribution, `PLATFORM_CUT_RATE = 0.1`
  only on redistribution.
- The AI-gatekeeper hard constraint from `PROJECT_BRIEF.md`: only real-time/
  local/ephemeral facts get escalated to a human, never general knowledge.
- Violet/fuchsia brand, sphinx mascot, the connect-modal UX in
  `WALLET_UX_SPEC.md`. This is a copy/mechanism fix, not a redesign.

---

## 2. Kill list — remove before demo day

Work through these in order; each is small and self-contained.

### 2.1 Delete the $PURR mint entirely
- Delete `src/lib/purr-token.ts`.
- Delete `scripts/create-purr-mint.ts` and `scripts/add-purr-metadata.ts`.
- Remove `PURR_MINT_ADDRESS` and `PURR_METADATA_URI` from `.env.example`,
  `.env.local`, and the README's env var table.
- Remove the `@metaplex-foundation/*` deps from `package.json` **only if**
  nothing else in the app uses Metaplex (grep first — they may be pulled in
  by the base template for something unrelated; don't remove blind).

### 2.2 Strip `purrAwards` out of the round/payout path
In `src/lib/round-payout.ts`:
- Remove `import { awardPurr } from './purr-token'`.
- Remove the `purrAwards` object and its `try/catch` mint loop in
  `payoutJudgedRound()`.
- Keep the `recordJudgment(answer.verifierWallet, isCorrect)` call — that's
  the non-token reputation write, already correct, don't touch it.

In `src/lib/verification-rounds.ts`:
- Remove `PurrAwardRecord` and the `purrAwards` field from
  `VerificationRound`. (If you want to keep the per-answer bonus chips in
  the UI — speed/photo/location badges are a nice, cheap piece of craft —
  see 2.4 below for the non-token replacement instead of deleting the idea
  outright.)

### 2.3 Rewrite tiers to run on reputation, not token balance
`src/lib/tiers.ts` — replace `minPurr` with `minCorrect`, drop `feeShare`
(it isn't load-bearing in the payout split today, and keeping a "fee share"
number on a tier card is exactly the token-gating pattern the data flags —
don't reintroduce it under a new name):

```ts
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
```

(Thresholds are placeholders — tune once you see real round counts from
section 6's live test.)

### 2.4 Optional: keep the bonus-chip UI, source it from a pure function
If you want to keep showing "+5 speed · +5 photo · +5 location" chips
(they're good craft, don't lose them for free), add
`src/lib/reputation-points.ts`:

```ts
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
```

Call this from `round-payout.ts` in place of the deleted `awardPurr`, and
store the resulting number as a `points` field alongside `correct`/
`incorrect` in `src/lib/reputation.ts`'s Redis/file record (same
read/write pattern already there — extend `Reputation` and
`recordJudgment`, don't rewrite the module). **Nothing here mints, sends,
or holds anything of value — it's a leaderboard number, not an asset.**
That distinction is the entire point; keep it legible in the code (a
comment on the type is enough) so it can't quietly grow back into a token.

### 2.5 Update the API and UI surfaces
- `src/app/api/reputation/route.ts`: remove the `getPurrBalance` /
  `PURR_MINT_ADDRESS` import, return
  `{ ...reputation, tier: tierFor(reputation.correct) }` instead.
- `src/components/trustsaur/rounds-data-access.tsx`: change the `tier`
  type's `minPurr`/`feeShare` fields to match the new `TierInfo` shape.
- `src/components/trustsaur/trustsaur-feature.tsx`: swap the `purrAwards`
  read (around the existing `purr` variable) for the new `points`
  breakdown from 2.4, and change any visible "$PURR" copy to "points" or
  "reputation" — never "token," never a ticker symbol.
- `src/app/api/agent-action/status/route.ts`: drop `purrAwards` from the
  JSON response shape (or rename to `points` if you kept 2.4).

---

## 3. Copy rewrite — paste these verbatim

**README opening paragraph** — keep as-is, it already reads as "Human
DePIN" in spirit:
> Before an AI agent spends your money, it asks a real human first.

**New one-line positioning** (use on the site hero and the pitch deck,
replacing generic "trust network" language):
> Human DePIN — proof-of-presence infrastructure for AI agents. Verifiers
> stake real money on ground-truth facts a model has no way to know.
> Settled in SOL, no native token.

**Delete this sentence wherever it appears** (README, deck, any UI
tooltip): *"each also earns `$PURR` reputation, which unlocks fee-share
tiers over time."* Replace with:
> Correct answers build a public reputation score. Higher reputation earns
> a visible tier badge — nothing tradable, nothing to speculate on.

**Roadmap section, if you keep one in the deck** — remove "`$PURR` token +
logo, referral split" and "Rarity-tiered reveal cards from existing mascot
art" entirely. Replace with:
> Referral program paid in SOL, forever — 10% of a referred verifier's
> future stake-pool earnings, same mechanic as the platform take-rate,
> no separate token.

---

## 4. Optional stretch — USDC settlement

Only start this after sections 2–3 are done and section 6's live test has
run once. Stablecoin settlement had the second-strongest positive signal
in the winner data (behind only DePIN framing itself), so it's worth the
time if you have it, but it is additive — nothing in section 2 depends on
it.

- Add `src/lib/usdc-pay.ts`, mirroring `solana-pay.ts`'s
  `releaseMultiVerificationPayment` but moving SPL-token transfers instead
  of `SystemProgram.transfer`. Devnet USDC mint:
  `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (Circle's devnet faucet
  mint — confirm it's still live before wiring it in).
- Add a `stakeMint: 'SOL' | 'USDC'` field to `VerificationRound`; the
  asker or the first verifier picks it when a round opens; every
  subsequent stake and the eventual payout use that same mint. Don't let
  it vary mid-round — that's a reconciliation bug waiting to happen.
- UI: a two-option toggle next to the stake amount, matching the existing
  card style in `verify-feed-feature.tsx`.

---

## 5. Devnet readiness checklist

`PROJECT_BRIEF.md` flagged this as the one real blocker: payouts currently
run against a **local test validator**, not public devnet, because the
public faucet kept rate-limiting during testing. Fix before section 6 —
two outside testers can't hit your laptop's local validator.

- [ ] Point `SOLANA_RPC_URL` at a real devnet RPC — either
      `https://api.devnet.solana.com` or a free-tier Helius/QuickNode
      devnet endpoint if the public one rate-limits you again.
- [ ] Fund `.wallets/payer.json` with enough devnet SOL to cover every
      payout in the live test (10 rounds × ~0.01 SOL stake × up to 5
      verifiers — budget at least 1 devnet SOL, get more than you think
      you need, faucets are unreliable).
- [ ] Confirm the Telegram verifier bot and `/register <address>` flow
      both work against this RPC end-to-end once, solo, before bringing in
      the two outside testers.
- [ ] Confirm `retry-payout` (`src/app/api/rounds/[id]/retry-payout/route.ts`)
      actually recovers from a dropped devnet transaction — simulate one
      failure on purpose (kill the network mid-request) so you know the
      retry path works before you need it live in front of testers.

---

## 6. Two-real-people test protocol

This matters more than more code right now — `PROJECT_BRIEF.md` explicitly
says a small seeded pool of real testers is enough for a 3-day demo, and a
handful of genuine resolved rounds is stronger demo-day evidence than any
amount of roadmap slide.

**Setup**
- Recruit 2 people who are not you. Ideally one plays "asker" (submits
  real questions via the `/verify` UI or the `/api/agent-action` endpoint)
  and both play "verifier" (answer each other's and your own rounds), so
  you get both sides of the flow exercised by someone other than the
  builder.
- Each tester needs: a Solana wallet (Phantom/Solflare/Backpack — whatever
  they already have), it switched to devnet, and enough devnet SOL to
  stake on ~5 rounds (send them some from your funded payer wallet, or
  point them at a faucet ahead of time so faucet flakiness doesn't eat
  the session).
- Give them zero instructions on *how* to use the UI beyond "open this
  link and figure it out" — the onboarding flow (`onboarding-intro.tsx`)
  is supposed to carry that job. If it doesn't, that's a finding, not a
  reason to explain it verbally.

**Script — run at least 8–10 real rounds across the two testers**
1. Connect wallet (both testers, cold — no prior session).
2. Register with the Telegram bot if that's still the verifier-notify
   path; note how long registration takes and whether either tester gets
   stuck.
3. One tester submits a real, checkable local fact through `/verify` —
   something genuinely true right now, not a hypothetical (e.g. "is
   [specific real café near them] open right now," "is [a specific store
   shelf] actually stocked" if they can check it, or any real-time fact
   both can independently confirm). Fake/hypothetical questions won't
   surface real UX friction around photo/location proof.
4. Both testers answer as verifiers: at least once with photo proof, once
   with location proof, once with neither, so all three proof paths get
   exercised.
5. Let the round resolve on its own via consensus — don't manually force
   anything. Confirm the SOL payout actually lands in the correct
   wallet(s) and the reputation number ticks up for the correct answerer
   (check `/api/reputation`).
6. Repeat with roles swapped, and with at least one round that resolves as
   a tie/push and one that resolves as a real majority, so you've seen
   both payout paths live, not just in the code.

**What to log, per round:** time to first answer, any point either tester
paused and asked "what do I do now," any error toast, whether the payout
signature actually resolved on the devnet explorer, and reputation
tier/points before vs. after.

**Success criteria before you call this demo-ready**
- Both testers completed a full round (ask or answer → payout confirmed)
  with zero verbal help from you.
- At least one real majority-resolution payout confirmed on-chain.
- Zero instances of "$PURR," "token," or a ticker symbol anywhere either
  tester saw during the session — if either of them describes the app back
  to you afterward and calls it a "token thing," the copy rewrite in
  section 3 isn't finished.

---

## 7. Order of operations

1. Section 2 (kill $PURR, wire reputation-based tiers) — do this first,
   it's the highest-leverage fix per the data and it's mechanical.
2. Section 3 (copy rewrite) — quick, do it same sitting as section 2 so
   code and copy don't drift apart.
3. Section 5 (devnet readiness) — blocking for section 6, start funding
   the payer wallet early since faucets are slow/unreliable.
4. Section 6 (two-person live test) — run it, fix whatever breaks, run it
   again if anything broke.
5. Section 4 (USDC settlement) — only if 1–4 are solid and you still have
   runway before demo day.
6. Update `PROJECT_BRIEF.md`'s "Build status" checklist and the README's
   env var table to match what's actually true after all of the above —
   both currently still describe `$PURR` as live.
