# Large, colour-coded chamber labels on the homepage

## Goal
On the homepage chamber cards (the "CHAMBER 01 … CHAMBER 10" eyebrow above each card), make the chamber number a large heading and give each chamber its own distinct colour, drawn from the existing sector palette so the whole system stays token-based.

## Current state (verified)
- The label lives in `src/components/marketing/ChamberPanel.tsx` line ~69: `<span className="pt-1">Chamber {index}</span>` inside a `text-[11px]` uppercase mono row — currently tiny, ink-500 grey.
- Every chamber already carries an `accentVar` in `src/lib/chambers.ts` (`--sector-01` … `--sector-12`), used for the small hairline accents and screenshot outline.
- All twelve sector tokens are registered in `@theme inline` of `src/styles.css`, so `text-sector-01` etc. exist — but two collisions break "each chamber a specific colour":
  - Chamber 03 and Chamber 09 both use `--sector-09` (purple)
  - Chamber 06 and Chamber 10 both use `--sector-10` (mauve)

## Recommended approach
Colour the label through the chamber's existing `accentVar` (inline `style={{ color: var(--accentVar) }}`), so the number, the hairline accents and the screenshot outline all read as one identity — and fix the two collisions by adding two dedicated chamber tokens.

### Changes

1. **`src/styles.css`** — add two tokens to the sector spectrum block (light, calm, distinct from neighbours on paper):
   - `--chamber-09: #2f5d8a;` (deep steel blue — distinct from sector-09 purple used by Chamber 03)
   - `--chamber-10: #6b5b3a;` (bronze-olive — distinct from sector-10 mauve used by Chamber 06)
   - Register both in `@theme inline` (`--color-chamber-09`, `--color-chamber-10`).

2. **`src/lib/chambers.ts`** — point Chamber 09's `accentVar` to `--chamber-09` and Chamber 10's to `--chamber-10`. All other chambers keep their sector tokens.

3. **`src/components/marketing/ChamberPanel.tsx`** — restyle the "Chamber NN" label:
   - Scale up from `text-[11px]` to a large display treatment: `font-serif text-[26px] sm:text-[32px]` with `tracking-tight`, keeping the mono `Chamber` wordmark idea out — the number becomes a heading.
   - Colour via `style={{ color: `var(${accentVar})` }}` so no hardcoded colours are introduced.
   - Keep the small mono uppercase style for the section row's other metadata (only the chamber label grows), and keep the header illustration beside it aligned.

## What stays the same
- No borders, rails or card layout changes — the label is the only edit surface.
- All accents, hairlines, screenshot outlines keep working via the same `accentVar`.
- Reduced-motion, buttons and JSON rules untouched.
