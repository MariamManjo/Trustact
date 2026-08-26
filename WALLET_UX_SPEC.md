# TrustSaur — Wallet & Ask UX Spec

Reference screenshots are attached in the Cursor chat: Magic Eden's login,
wallet picker, connect states, and account dropdown; Jupiter's swap card.
**Copy their structure and interaction patterns. Do not copy their colours.**
Magic Eden pink (`#E42575`) and Jupiter lime are their brands — every accent
in our build is violet/fuchsia, matching the existing app.

---

## 0. Design tokens

Reuse what the app already has; don't introduce a second palette.

| Token | Value | Used for |
|---|---|---|
| Accent | existing violet-500 | primary CTA, links, active states |
| Accent gradient | existing violet→fuchsia | header logo, hero, tier badges |
| Surface | `bg-black/20` on dark base | cards, list rows |
| Surface raised | one step lighter | modals, dropdown panel |
| Border | `border-white/10` | card edges, dividers |
| Radius | `rounded-2xl` cards, `rounded-xl` rows, `rounded-full` pills |
| Modal width | 420px desktop, full-width minus 16px on mobile |

Every panel in the reference shots is a dark card floating over a **blurred,
dimmed** page. Match that: `backdrop-blur-md` + `bg-black/60` on the overlay.
It's the single biggest thing making those screens feel expensive.

---

## 1. Connect modal — replaces the default wallet-adapter modal

Reference: "Log in or sign up" and "Select your wallet" screenshots.

**Skip the email field entirely.** Magic Eden has it because they use an
embedded-wallet provider (Privy/Dynamic). We don't, and faking it would be
a dead input. Wallet-only is also more crypto-native, which is the right
signal for our audience.

**Structure — one modal, two steps:**

*Step 1 — wallet list*
- Header: back arrow (hidden on first step), centered title "Connect your
  wallet", close X. All three on one row, title optically centered.
- Search input, full width, `rounded-xl`, magnifier icon left.
- Wallet rows: 56px tall, icon 32px left, name, "Popular"/"Detected" label
  right in muted text. `rounded-xl`, hover lightens the row background.
- Order: Phantom, Solflare, Backpack, Coinbase, Trust. Detected wallets
  float to the top with a "Detected" label — this is a real usability win
  the reference has and most clones miss.
- Footer: "By continuing, you agree to our Terms & Privacy." Muted, 12px.

*Step 2 — connecting*
- Reference: "Click connect in your wallet popup".
- Show the chosen wallet's logo, large and centered, with a subtle pulse.
- One line of copy: "Confirm in your wallet". Nothing else.
- Back arrow returns to the list. This state must be **cancellable** — a
  stuck modal with no exit is the most common bug in these flows.
- Skip the Ledger toggle. It's a Phantom-specific edge case and we can't
  test it.

**States to handle** (the reference doesn't show these; build them anyway):
- Wallet not installed → row shows "Install" and opens their download page.
- User rejects → return to step 1 with a small inline message, not a toast.
- Timeout → same as reject.

---

## 2. Sign-in with Solana

Reference: the "Sign Message" screenshot.

After connect, request a `signMessage`. Message body:

```
trustact.vercel.app wants you to sign in with your Solana account:
<address>

This proves you control this wallet. It costs nothing and approves no
transaction.
```

That second sentence isn't in the reference — add it. Most people don't
know a signature isn't a payment, and saying so plainly is a small trust
win that costs one line.

Store the verified session client-side. If the user declines, they stay
connected but unauthenticated — don't disconnect them, just leave
authenticated-only actions gated.

---

## 3. Header wallet pill

Reference: Magic Eden's "0.017 SOL" pill with avatar.

- Disconnected: a single button, "Connect wallet", accent-filled, pill.
- Connected: pill showing **SOL balance** + a 24px avatar circle, plus the
  existing devnet chip beside it.
- Avatar: use the mascot at Rookie/Bronze/Silver; at Gold, swap in the
  unlocked character from `/characters/`. This makes tier progress visible
  in the chrome of the app, permanently — much stronger than burying it on
  a leaderboard page.
- Click opens the dropdown below, anchored right, 8px gap.

---

## 4. Wallet dropdown — the important one

Reference: Magic Eden's account panel. Ours is simpler; drop what doesn't
apply.

Panel: 360px wide, `rounded-2xl`, dividers between sections.

**Section 1 — identity**
- Avatar + truncated address (`4QhGS3b…u11E`) + copy button with a
  "Copied" confirmation.
- Tier badge beside the address: Rookie / Bronze / Silver / Gold, in the
  accent gradient at Gold only.

**Section 2 — balance**
- SOL balance in large type (28-32px, tabular numerals), USD equivalent
  muted underneath.
- Drop Magic Eden's Escrow / Lucky Buy rows — we have no equivalent, and
  empty rows reading "0" make a product look unfinished.

**Section 3 — actions**
- Two buttons, equal width: **Receive**, **Send**.
- Receive: address + QR code, copy button. Fully working, it's trivial.
- Send: leave it **disabled with a "Soon" pill**, not a fake flow. A
  disabled control that's honest beats a button that errors.
- Skip "Buy" — that's a fiat on-ramp we don't have.

**Section 4 — tokens**
- Row per token: icon 32px, name + symbol stacked left, balance + USD
  stacked right.
- SOL first, then **$PURR** — icon is `/token/purr-512.jpg`, name "Purr
  Points", balance from `getPurrBalance()`.
- Under the PURR row, a thin progress bar to the next tier with a label:
  "35 more to Silver". This is the retention hook made visible, and it's
  the one element in this whole spec that's genuinely ours rather than
  borrowed.

**Section 5 — footer**
- "Log out", muted, full width. Clears the session and disconnects.

---

## 5. Ask form — restyle using Jupiter's card pattern

Reference: the Jupiter swap screenshot. This pattern maps onto our Ask flow
better than it maps onto anything else in the app.

- Tab row at top: **Quick (90s) · Standard (10 min) · Extended (1 hr)** —
  same treatment as Jupiter's Market / Limit / Recurring, accent pill on
  the active tab. This replaces a dropdown and makes the time window a
  visible, deliberate choice.
- Card 1 — "Your question": large textarea, generous padding, placeholder
  `is the café on Rustaveli open right now?`.
- Card 2 — "You pay": fee in large numerals (like Jupiter's amount), SOL
  chip on the right, USD equivalent muted below.
- Summary row between card 2 and the CTA, `rounded-xl`, muted: verifiers
  online, expected response time.
- CTA: full width, 52px tall, `rounded-xl`, accent-filled — "Ask
  verifiers". Disabled until a question is entered and a wallet connected.

Keep the existing result card as-is. It already works and it's proven.

---

## 6. Build order

Build in this order and stop after each so it can be reviewed:

1. Connect modal (steps 1 + 2, all error states)
2. Header pill
3. Wallet dropdown — identity, balance, tokens, log out
4. Receive sheet with QR
5. Sign-in with Solana
6. Ask form restyle

Sign-in is deliberately fifth. It's the least visible and the most likely
to eat time on edge cases.

---

## 7. Rules

- One component per step. Show a screenshot or the diff before moving on.
- No new colour values. Reuse tokens already in the app.
- Never ship a control that looks live but isn't — disable it and label it.
- Every modal must be closable by X, backdrop click, and Escape.
- Test at 375px width. The reference screenshots are desktop; our judges
  and users will open this on phones.
