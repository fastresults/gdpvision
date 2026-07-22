## Root cause — invisible button labels

Buttons like "Start a request" render as black slabs with no visible text because `text-paper-50` is used **78 times across the codebase but never defined**. The design tokens only define `paper-0` and `paper-100` (see `src/styles.css` lines 69–70). Tailwind v4 silently drops the unknown class, the `<button>` inherits `color: var(--ink-950)` from the body, and the label becomes black text on the black `bg-ink-950` fill.

The same 78 files also use `bg-paper-50` and `hover:bg-paper-50` — both no-ops today, so hover states do nothing.

The `hover:opacity-90` on primary buttons is a second, smaller issue: 90% of black is still black, so the hover state is visually imperceptible.

## The fix — one contract, enforced

### 1. Close the token gap in `src/styles.css`

Add the missing token so every existing class resolves correctly, and add a small palette of interaction tokens buttons need:

```
--paper-50: #f7f7f2;             /* between paper-0 and paper-100 */
--ink-hover: #1e3350;            /* one step off ink-950 for hover */
--gold-hover: #a37826;           /* one step off gold-500 for hover */
```

Register them in `@theme inline` as `--color-paper-50`, `--color-ink-hover`, `--color-gold-hover`. This alone makes every `text-paper-50` / `bg-paper-50` / `hover:bg-paper-50` in the tree resolve without touching component code.

### 2. Canonical button utilities (the global contract)

Add three `@utility` classes in `src/styles.css`. Every clickable primary/secondary/ghost surface in the app must use one of these — never re-invent `bg-ink-950 text-paper-50 hover:opacity-90` inline again:

```
@utility btn-primary    /* bg-ink-950, text-paper-0, hover:bg-ink-hover, focus ring gold */
@utility btn-secondary  /* bg-paper-0, text-ink-950, border line-200, hover:bg-paper-50 */
@utility btn-ghost      /* transparent, text-ink-500, hover:text-ink-950 hover:bg-paper-50 */
@utility btn-accent     /* bg-gold-500, text-paper-0, hover:bg-gold-hover */
```

Each utility owns text color, background, border, hover, focus-visible, and disabled state. Buttons stop carrying those concerns inline.

### 3. Enforce via lint

Add ESLint rules (`no-restricted-syntax` on JSX className strings, similar to the existing `PrettyJson` guard):
- Ban raw `text-white`, `bg-black`, `text-black`, `bg-white` in components.
- Ban the anti-pattern `hover:opacity-` on any element that also has `bg-ink-` or `bg-gold-` (real hover uses a color, not opacity).
- Warn on inline `bg-ink-950 text-paper-` combos on `<button>`/`<a>` — those must use `btn-primary`.

Also add a one-time `bunx tsgo --noEmit`-adjacent check script `scripts/check-tokens.ts` that greps for Tailwind color classes referencing tokens not present in `@theme inline` (e.g. catches the next `paper-50`-style typo before it ships).

### 4. Save as project memory

Write two `mem://` entries so I stop re-introducing this:
- `mem://design/button-contract` — every button uses `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-accent`; never `bg-ink-* text-paper-* hover:opacity-*` inline.
- Update `mem://index.md` **Core** with a one-liner: "Buttons use `btn-*` utilities from styles.css; never inline `bg-ink-* text-paper-* hover:opacity-*`. Only tokens declared in `@theme inline` exist (paper-0/50/100, ink-300..950, gold-500, gold-hover, ink-hover, signal-*, sector-01..12)."

### 5. Migrate the current offenders

Replace inline button styling in the files the screenshot exposed:
- `src/routes/_authenticated/console.tsx` (nav "Start a request", "Exit" button, "Sign out")
- `src/routes/_authenticated/console.$code.index.tsx` (hero "Start a request", starting-prompt chips)
- `src/routes/_authenticated/console.$code.request.new.tsx` (Continue / Send / outcome + ministry cards / stepper active state / timing chips)
- `src/routes/_authenticated/console.$code.requests.index.tsx` (top "Start a request")

Selected cards (outcome/ministry/timing) still use `bg-ink-950 text-paper-0` inline because they're not buttons semantically — but now `text-paper-0` (a real token) instead of the phantom `text-paper-50`.

### 6. Verify

Run `tsgo --noEmit`, then a Playwright element-screenshot of the console hero button and the wizard's Continue button to confirm the label is visible and the hover state actually changes color.

## What this rules out going forward

- Silent invisible text from typo'd color tokens (script + lint catch it).
- Black-on-black or white-on-white buttons (banned literal utilities).
- Imperceptible hover on dark buttons (`hover:opacity-*` on tinted backgrounds is banned; hover uses a real color).
- Divergent button styling across chambers/console/marketing — one utility, one look.

## Scope note

This is a styling/tokens contract change only. No behavior, routing, data, or copy changes.