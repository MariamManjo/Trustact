# Trustact

**Before an AI agent spends your money, it asks a real human first.**

Live: [trustact.manjom.works](https://trustact.manjom.works) · Devnet

Autonomous AI agents (shopping, booking, concierge bots) act on what they
*know* — not on what's actually true right now. "Is this restaurant open?"
"Is this item still in stock?" are real-time facts no model can know from
training data. Trustact is a confidence check: before an agent commits real
money, it pays a small fee to get that one fact verified by a real person —
then payment releases automatically on Solana.

## How it works

1. **Ask** — an agent (or a human, via the demo UI) describes an action it's
   about to take. An AI gatekeeper decides whether this needs a human: only
   real-time, local, ephemeral facts get escalated — general knowledge is
   answered automatically, for free, with no human involved.
2. **Verify** — if needed, up to 5 connected-wallet verifiers see the
   question on `/verify` and answer, optionally backed by a live camera
   capture and/or GPS location (never a file upload — proof has to be taken
   right now, not pulled from a saved photo).
3. **Judge** — the asker marks each answer correct/incorrect and can pick a
   speed bonus winner.
4. **Pay** — a real Solana transaction splits the fee across correct
   verifiers, and each also earns `$PURR` reputation, which unlocks fee-share
   tiers over time.

Everyone signs in with **Sign-In With Solana** (connect wallet → sign a free
message proving ownership) — no passwords, no separate accounts. Verifiers
can optionally opt an email in to get notified when a new question opens.

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn/ui, dark-only design (see `brand.md`)
- **@solana/web3.js** + **wallet-adapter** — real devnet transactions, custom
  connect modal (Phantom/Solflare/Backpack/Coinbase/Trust), mobile universal
  links for wallets with no browser-extension presence
- **OpenAI** — the AI gatekeeper deciding what needs a human
- **Upstash Redis** (via Vercel Marketplace) — rounds, reputation, sessions,
  notification subscriptions; falls back to local JSON files when no KV
  credentials are configured, so local dev needs no external DB
- **Vercel Blob** — verifier-submitted photo proof storage
- **Resend** (via Vercel Marketplace) — new-round notification emails
- **Anchor** — a scaffolded Solana program (`anchor/`) from the base
  template; not currently load-bearing for the core product flow

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

| Variable | Required for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | AI gatekeeper | required |
| `SOLANA_RPC_URL` | on-chain reads/writes | e.g. `https://api.devnet.solana.com` |
| `AGENT_API_KEY` | `/api/agent-action` (headless agent API) | any string you choose |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | persistence | omit for local file-store fallback |
| `BLOB_READ_WRITE_TOKEN` | photo proof storage | Vercel Blob |
| `RESEND_API_KEY` / `RESEND_EMAIL_DOMAIN` | notification emails | omit to skip sending |
| `PURR_MINT_ADDRESS` / `PURR_METADATA_URI` | `$PURR` reputation token | see `scripts/create-purr-mint.ts` |

A payer keypair lives at `.wallets/payer.json` (gitignored) — the account
that signs outgoing SOL/`$PURR` transfers. Generate one and fund it on
devnet before testing payouts.

## Public API

Headless agents can integrate directly without the UI:

```
POST /api/agent-action
Authorization: Bearer <AGENT_API_KEY>
{ "agentId": "...", "action": "..." }
```

Returns either an immediate approval or a `pending_verification` response
with a `statusUrl` to poll. See `src/app/api/agent-action/route.ts`.

## Deployment

Deployed on Vercel from `main`. `brand.md` documents the visual system;
`WALLET_UX_SPEC.md` documents the wallet/connect UX this was built against;
`PROJECT_BRIEF.md` has the product research trail (why this idea, what was
tried and rejected before it).

Built on the official Solana Foundation
[`create-solana-dapp`](https://github.com/solana-developers/create-solana-dapp)
template.
