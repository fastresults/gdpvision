# Mobile-first Console — bulletproof overhaul

Scope is strictly the country-user surface at `/console/*` and its shared components. Agency-side chambers are untouched.

## Audit — concrete failures at 393×852 (verified in the source)

1. **Wizard stepper overflows the viewport.** `console.$code.request.new.tsx` renders four uppercase labels ("What you need · Which ministry · What form · When") with 6-px numbered discs and 24-px connector rules on one horizontal row. On 393-px width the row runs off-screen and either wraps ugly or causes horizontal scroll — the very first thing a minister sees.
2. **Masthead type is oversized on phones.** `console.$code.index.tsx` uses `font-serif text-5xl` (48 px) for "Good day, …". Combined with `space-y-14` (56 px) rhythm between sections the page reads as a desktop layout squeezed into a phone.
3. **Composer textarea is a 144-px wall on mobile.** `StudyComposer` forces `minHeight: 9rem` + `rows={4}` regardless of viewport, pushing the primary action below the fold on iPhone SE / 393-px devices.
4. **Requests list header collides at 393 px.** `text-4xl` title + primary "Start a request" button in a two-column grid — button text truncates against the heading.
5. **Filter chips don't respect tap-target contract.** `card-choice px-4 py-2 text-xs` = ~32 px tall (< 44 px). Fails the button contract for touch.
6. **Country identity is hidden on mobile.** In `console.tsx` the flag + country name are `hidden sm:inline`; on phones the user cannot see which country the session is scoped to — dangerous for super-admin view-as.
7. **Attention band cards waste vertical space on mobile.** `p-5` + `text-3xl` counters + two lines of supporting copy each, stacked three-tall = ~360 px before the composer.
8. **Request detail progress rail is a 6-row list on mobile.** `sm:grid-cols-6` collapses to one column below 640 px, producing a tall repetitive rail instead of a compact horizontal step indicator.
9. **Ask page composer** uses `rows={1}` textarea that grows unpredictably and the "Enter to send" hint is hidden on mobile — no discoverable way to send by keyboard.
10. **Bottom-fixed bars on wizard and Ask can double with the OS home indicator** — safe-area padding is set, but the Ask composer's `pb-40` spacer above still leaves a dead zone on short screens.
11. **`min-h-screen` without `min-h-dvh`** on the shell — on iOS Safari the URL bar chrome eats 60 px and the footer clips.
12. **Hero decorative blur** in StudyComposer (`-right-16 -top-16 h-64 w-64 blur-3xl`) is fine because the parent has `overflow-hidden`, but wizard step sections have no such guard — the outcome grid at 393 px risks touching viewport edges.

## Design principles

- **Mobile is the default breakpoint.** Every screen must be complete and usable at 393×852 before any `sm:` / `md:` overrides. Desktop is `sm:`/`md:` progressive enhancement, not the other way around.
- **44×44 tap targets everywhere.** No exceptions on the country surface.
- **Vertical rhythm halves on mobile.** `space-y-14` → `space-y-8 sm:space-y-14`. `text-5xl` → `text-3xl sm:text-5xl`.
- **Bottom of screen is sacred.** Sticky action bars own the bottom; content pads for them via `pb-[calc(env(safe-area-inset-bottom)+96px)]`.
- **No horizontal scroll, ever.** Any horizontal list becomes a snap-scroll strip with `overflow-x-auto snap-x` and visible fade edges — never overflow into layout.
- **`min-h-dvh`** on the shell so iOS Safari URL-bar collapse doesn't reveal a broken footer.

## Fix plan

### 1. Shell — `console.tsx`

- Swap `min-h-screen` → `min-h-dvh`.
- Replace the mobile-hidden flag/name block with a **compact country chip** always visible on mobile: `[flag] [ISO]` (44-px tap area) placed to the right of the Wordmark.
- Hamburger drawer becomes a full-height sheet with safe-area top padding and an explicit "Signed in as {name}" row.
- Footer text drops to `text-[9px]` and wraps to two lines on phones.

### 2. Study index — `console.$code.index.tsx`

- **Masthead**: date eyebrow stays; heading becomes `text-3xl sm:text-5xl`, `leading-tight`, `space-y-8 sm:space-y-14` between all sections.
- **Attention band**: on mobile becomes a **snap-scroll strip** of 3 compact cards (`min-w-[75%] snap-start`) with the counter on the left and the label + one-line context on the right — 96 px tall instead of 360 px stacked. Promotes to `sm:grid sm:grid-cols-3` at ≥640 px unchanged.
- **StudyComposer**: mobile textarea shrinks to `rows={3}` and `minHeight: 6.5rem`; primary Continue/Ask button becomes full-width on mobile (`w-full sm:w-auto`) so the CTA stays above the fold.
- **In-flight lanes**: keep list rows but replace the right-side elapsed chip with a two-line stack under the title on mobile (`flex-col sm:flex-row`) so long questions don't truncate to 20 chars.
- **Ministries + Cabinet**: keep single-column mobile, but each card gets `min-h-24` and a "See all" link when >3 items instead of `slice(0, 6)`.

### 3. Request wizard — `console.$code.request.new.tsx`

- **New `<WizardStepper />` component**, mobile-first:
  - Mobile: shows `Step {n} of 4 · {label}` on one line + a 4-dot progress row underneath (dots = 8 px, spacing 6 px). No horizontal overflow possible.
  - `sm:` and up: the full labelled row we have today.
- **Sticky bottom bar**: `Back` becomes `Cancel` on step 1 and always shows the current step number; primary CTA becomes full-width on mobile with the label on top and the icon on the right.
- **Step 1 textarea**: `rows={5}` on mobile, `p-4 text-base` (not `text-lg`) so the "Speak / Attach / Photo" row stays visible above the sticky bar. `Photo` chip promoted so it renders on all screens (currently `sm:hidden`, correct — keeps mobile-only path).
- **Step 3 outcome cards**: single column on mobile with tighter `p-4`, chamber turnaround shown as a right-aligned mono chip inline.
- Add `overflow-x-hidden` guard on the wizard root.

### 4. Requests list — `console.$code.requests.index.tsx`

- Header restructures: title on its own row on mobile, `Start a request` becomes a **sticky bottom FAB** (`fixed bottom-4 right-4 sm:static`) at ≥640 px it returns to inline top-right.
- Filter chips become `min-h-11` `overflow-x-auto snap-x` strip on mobile with visible active state; on desktop they wrap as today.
- List rows: on mobile the elapsed-time chip drops below the meta line (`flex-col`), so long questions get full row width.

### 5. Ask thread — `console.$code.ask.tsx`

- Composer textarea: `min-h-[52px]` autosize up to 40vh; Enter-to-send hint shows on both mobile and desktop but shorter on mobile ("Enter to send").
- Content region padding: `pb-[calc(env(safe-area-inset-bottom)+128px)]` replaces `pb-40` so the last turn is never behind the composer.
- Empty-state canned prompts: single column mobile with `min-h-16`.
- Turn cards: user bubble `max-w-[92%]` on mobile (currently 85 % = tight with padding), assistant "spoken" block `text-base sm:text-lg` so 393-px screens don't scroll horizontally on long sentences.
- "Send it to the team" CTA becomes its own full-width button below the source list on mobile — currently a wrapped inline flex that clips.

### 6. Request detail — `console.$code.requests.$id.tsx`

- Progress rail: on mobile becomes a **single horizontal snap-scroll strip** of six pill-shaped chips with the active one bold. On `sm:` and up, keeps the 6-column grid.
- Deliverable list rows: icon shrinks to `h-7 w-7`, title `text-base`, actions become full-width buttons under the summary on mobile.
- Back link becomes a 44-px chip.

### 7. Global contract updates in `src/styles.css`

- New `@utility mobile-container { @apply px-4 sm:px-6; }` used by every console route root so we stop scattering padding.
- New `@utility hstrip { @apply -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible; }` for attention band + filter chips + progress rail.
- Extend `card-choice` / `card-choice-active` and every filter chip usage with `min-h-11` baked in so this class of bug can't recur.
- Add `@utility safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 96px); }` for scrollable regions above fixed bars.
- Update `mem://design/button-contract` with a mobile addendum: "Every tap target ≥44 px; sticky bars must add `safe-bottom` to their scroll parent."

### 8. Verification (mandatory before we call it done)

Playwright script under `/tmp/browser/console-mobile/` at viewport **393×852** signed in as super-admin with impersonation → ATG, screenshotting:

- `/console/ATG` (top + scrolled to lanes + scrolled to delivered)
- `/console/ATG/ask` (empty + after one turn)
- `/console/ATG/request/new` (step 1 idle + step 1 with dictation focused + step 3 outcomes + step 4 review)
- `/console/ATG/requests` (all + in-flight filter active)
- `/console/ATG/requests/{id}` (progress rail visible + deliverables)

Each screenshot is inspected with `code--view`; the plan is complete only when there is zero horizontal scroll, every CTA is above the fold or on a visible sticky bar, and every tappable element measures ≥44 px.

## Files touched

- `src/routes/_authenticated/console.tsx`
- `src/routes/_authenticated/console.$code.index.tsx`
- `src/routes/_authenticated/console.$code.request.new.tsx`
- `src/routes/_authenticated/console.$code.requests.index.tsx`
- `src/routes/_authenticated/console.$code.requests.$id.tsx`
- `src/routes/_authenticated/console.$code.ask.tsx`
- `src/components/console/StudyComposer.tsx`
- **New** `src/components/console/WizardStepper.tsx`
- **New** `src/components/console/CountryChip.tsx`
- `src/styles.css` (utilities: `mobile-container`, `hstrip`, `safe-bottom`; strengthen `card-choice` tap target)
- `mem://design/button-contract` + `mem://index.md` addendum

## Non-goals

- No backend/server-function changes.
- No changes to `/admin`, chambers, marketing routes, or auth flows.
- No new dependencies.

## ASCII sketch — mobile Study index

```text
┌───────────────────────────┐
│ GDPVISION · [🇦🇬 ATG]  ☰ │  sticky header, 56 px
├───────────────────────────┤
│ WEDS · 22 JULY 2026       │
│ Good day, Antigua…        │  text-3xl
├───────────────────────────┤
│ ← [Ready 2] [Flight 5] →  │  snap-x strip, 96 px
├───────────────────────────┤
│ ┌ Ask ┃ Send ────────────┐│
│ │ What do you need?      ││  rows=3
│ │ [_______________]      ││
│ │ [🎤]        [Ask →]    ││  full-width CTA
│ └────────────────────────┘│
├───────────────────────────┤
│ In flight                 │
│ • Cruise tax brief …      │
│   MoF · In flight 2d 4h   │  meta stacks
├───────────────────────────┤
│ … footer …                │
└───────────────────────────┘
```
