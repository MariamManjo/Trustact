# TrustSaur — Project Brief

## What this is
Before an autonomous AI agent (a shopping/booking/concierge agent) spends real
money on someone's behalf, a real human verifies
one real-world fact it structurally cannot know — "is this place actually
open right now," "is this listing still live," "is there really a line" —
then payment releases automatically. AI narrows down *when* a human is
needed; it doesn't replace the human, and it doesn't ask humans things a
model could already know.

## Why this idea (the research trail, so it doesn't get lost)
This is the third major pivot in this project's research, each one for a
real reason:

1. **First idea (rejected):** a trading platform where every closed trade
   mints a shareable NFT explaining why it won/lost. Rejected because it
   independently stacked two of the weakest signals in Colosseum's own
   winner data — pure-NFT framing and "trading platform" — and the
   monetization (selling other people's loss NFTs) was never validated.

2. **Second idea, "TrustLens" (rejected):** a general-purpose service where
   any AI, for any question, escalates to anonymous paid crowd verifiers
   when uncertain. A detailed evidence-backed teardown (citing Veselovsky et
   al. arXiv:2306.07899, Farquhar et al./Nature 2024, OpenAI's hallucination
   research, and the ChaCha/Aardvark/Google Answers graveyard) showed this
   fails for **general knowledge questions** specifically: crowd workers
   just paste into ChatGPT, automated verification is ~100x cheaper, and
   almost every direct historical analogue died the same way.

3. **Third idea, AuditSaur (built, then abandoned):** AI-narrowed Solana
   smart contract audits, real auditor signs off. The economics were
   genuinely validated (audits cost $7K-150K, 1-4 weeks, auditor time is
   the bottleneck) and a working scan prototype was built and confirmed
   working. Abandoned anyway after real outside feedback: a person we asked
   found the pitch confusing and didn't rate the idea — for a 3-day demo
   pitched cold to judges, "hard to explain even to the founder" is
   disqualifying regardless of how sound the underlying economics are.

4. **TrustSaur (current):** takes TrustLens's mechanism (AI escalates to a
   human only when it's genuinely uncertain, paid automatically) and fixes
   its fatal flaw by narrowing the question type: only real-time, local,
   ephemeral facts a model has *no way* to know from training data — not
   general knowledge. This sidesteps the "crowd just uses ChatGPT" problem
   (there's no ChatGPT answer to paste for "is this door open right now")
   and the "verifier is worse than the model" problem (the model has zero
   information here, so any human with eyes beats it). It also sidesteps
   the "already the most crowded Colosseum category" problem of generic
   x402/agent-payment tools by being the one thing that category doesn't
   have yet: a trust checkpoint, not another payment rail.

## Target buyer
Developers/teams building autonomous shopping, booking, or concierge AI
agents (the x402 / Solana Agent Kit / agentic-commerce builder crowd).
Concretely: if their agent books a table at a restaurant that's actually
closed, or buys something actually out of stock, that's a real financial
mistake that destroys trust in their product. Paying $0.50-1 to verify a
fact before committing $50-500 of a user's money is cheap, obvious
insurance.

## Brand
Real character: a photo (`public/mascot.jpg`) of an AI-generated Sphinx cat
in Solana-branded gear (chosen over an earlier dinosaur concept). Used
throughout the UI — header, status cards, onboarding — with a radial CSS
mask so its white studio background blends into the app's dark/purple
theme instead of sitting in a hard box. Site theme is a violet/fuchsia
purple gradient (swapped from an earlier emerald accent).

## Build status — this is all real now, not simulated
- [x] Scaffolded from the official Solana Foundation template
      (`web3js-next-tailwind-basic` via `create-solana-dapp`)
- [x] `/api/verify` — OpenAI decides if a human check is needed
      (`src/lib/verify-action.ts` holds the shared prompt/logic)
- [x] **Real Telegram verification** (`src/lib/telegram-verifier.ts`) — not
      simulated. Sends a message with Yes/No buttons, supports a **group**
      of multiple verifiers (not one fixed contact), true first-tap-wins
      race resolution, and tracks *who* answered (shown in the UI and API
      responses, e.g. "@username").
- [x] Verifiers can **register their own Solana wallet** via the bot
      (`/register <address>`, `/mywallet` to check) — payment goes to the
      person who actually verified, not a fixed placeholder wallet
      (`src/lib/verifier-wallets.ts`, persisted to `.wallets/verifier-registry.json`).
- [x] **Real Solana payment** (`src/lib/solana-pay.ts`) — a real
      `SystemProgram.transfer`, running against **public devnet**
      (`https://api.devnet.solana.com`). Payer wallet funded (~1.6 SOL).
- [x] **Public agent-facing API** (`/api/agent-action` +
      `/api/agent-action/status`) — real external agents can call this, not
      just our own UI. Protected by `AGENT_API_KEY` (Bearer token,
      timing-safe comparison).
- [x] Animated onboarding intro (`onboarding-intro.tsx`) — plays every time
      the site opens, glowing/floating mascot, three steps explaining the
      problem/fix/payment.
- [x] Public devnet funding — payer at `.wallets/payer.json` holds enough
      SOL for the live-test budget. Verifier notify path is email + `/verify`
      (the Telegram bot from an earlier iteration is no longer in the repo).
- [x] `$PURR` mint removed. Tiers are reputation-based (correct-answer
      count + a leaderboard points number). No native token.

## Next up (requested, not yet built — for the next session)
User wants two more things before this feels "real":
1. **"Real Solana verification"** — the payer side currently uses a
   backend-held keypair (`.wallets/payer.json`), not a connected user
   wallet. Likely means wiring actual wallet-adapter connect/sign flows
   (the official template already includes `@solana/wallet-adapter-react`
   and a `WalletButton` in the header — it's present but currently
   decorative, not load-bearing) so a real user's wallet signs the
   transaction rather than a hidden keypair.
2. **A real wallet-style UI for send/receive** — referenced a polished
   crypto app screen (balance in large type, Send/Receive/Trade/More
   action-button row, a swap-style card). Likely wanted for the verifier
   side: a dashboard where a verifier can see their earned balance and a
   proper transfer UI, not just a raw signature + Explorer link buried in
   a status card. Confirm exact scope before building — could mean (a) a
   `/wallet` page for verifiers to view earnings, (b) restyling the
   existing payment confirmation to look like this reference, or (c)
   both.

## Hard constraints — do not drift from these
- Only ever route **real-time/local/ephemeral facts** to human verifiers —
  never general knowledge questions. This is the one thing standing between
  this idea and the graveyard the TrustLens teardown documented.
- Don't build a generic "AI agent payment rail" pitch — that lane (x402
  infrastructure) is the single most crowded category on Colosseum. The
  pitch is the verification/trust checkpoint, with payment as the
  mechanism underneath, not the headline.
- Don't over-scope for a 3-day demo: cold-start verifier supply, fraud/
  Sybil resistance, and payments/KYC regulation are real problems for a
  future company, not for this build. Simulated verifier responses and a
  small seeded pool of real testers on demo day are enough.
