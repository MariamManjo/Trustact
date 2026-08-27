# Brand — Trustact

_Status: documented (derived from existing usage, not run through `brand-design`)_

## Palette

Dark-first. Applied ad hoc via Tailwind utilities in components (not yet wired into
shadcn's `globals.css` tokens), consistently across onboarding, header, footer, and
the main feature card.

- Background: near-black violet — `#0a0710` (header/footer), radial gradient
  `rgba(29,19,64,1) → rgba(18,13,38,1) → rgba(7,7,12,1)` (onboarding, hero card)
- Primary accent: `violet-500` / `fuchsia-500` — used as a gradient
  (`from-violet-500 to-fuchsia-500`) on primary buttons and the wordmark
- Secondary accent: `violet-400` for the wordmark's second half and links
- Surfaces: `bg-white/5` to `bg-black/20` glass panels, `border-white/10` hairlines
- Status colors: `amber-500` (pending/waiting), `red-500`/`red-400` (declined/error),
  `violet-500` (success/paid)
- Text: `text-white` primary, `text-muted-foreground` / `text-neutral-400`/`text-neutral-500` secondary

## Typography

- System sans (no custom `next/font` wired in yet) — `font-extrabold` for headings/wordmark,
  `font-medium` for UI labels, `tracking-tight` on display text

## Voice

Direct, confident, no filler. Copy explains the mechanism in one sentence
("A confidence check for autonomous agents — verified by up to 5 real people, paid
automatically on Solana.") rather than marketing language.

## Mascot / brand mark

A Sphinx cat character in Solana-branded streetwear (pink glasses, purple/teal hoodie
with the Solana mark, SOL smartwatch) — transparent PNG at `public/mascot.png`. Used as
the header/footer brand mark (`BrandMark` component) and the animated hero character
(`TiltCharacter` component) on both onboarding and the main page.

To set up a fuller brand system (typography pairing, generated palette variations,
tone-of-voice doc) at any time, run:

    /brand-design

_Documented at: 2026-08-27_
