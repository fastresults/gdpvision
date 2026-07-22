## Goal

Replace the current mobile Ask surface at `/console/:code/ask` with the Chamber 01 chat experience (`AskTheLedger`), so ministers get the same tray-style Q&A, voice input, citations, expand actions, and grounded answers they see in Chamber 01 — front UI and back workflow identical.

## Why

`console.$code.ask.tsx` uses the `useCountryAskThread` / `askCounsel` + deep-research fallback pipeline. Chamber 01 uses `AskTheLedger` → `askTheLedger` server fn, which is the flow the user prefers (better answers, cleaner tray, voice, pin, expand). We standardize the Console Ask on that component and workflow.

## Scope

Change is UI + wiring only. No changes to `askTheLedger`, ledger functions, or Chamber 01.

## Changes

1. **`src/routes/_authenticated/console.$code.ask.tsx`** — rewrite as a thin mobile-first host:
   - Keep the empty-state hero (BrainMask constellation + flag + instruction line below it, above the composer — as it is now).
   - Remove the current `useCountryAskThread`, deep-research/expound/sources UI, canned-question grid, and custom composer sheet.
   - Render `<AskTheLedger countryCode={code} countryName={countryName} />` as the chat surface. Its built-in mobile behavior (bottom tray, mic, send, clear, copy, regenerate, pin, expand) becomes the Ask experience.
   - Preserve country resolution from `CARICOM_OECS_REGISTRY` and the existing route/head metadata.
   - Keep the bottom tab bar (Study / Ask / Send) intact; ensure `AskTheLedger`'s tray sits above `safe-bottom`.

2. **Mobile polish inside the Console context only** (in the route wrapper, not in `AskTheLedger`):
   - Auto-open the tray when the user taps into Ask, so no extra click is needed (pass an initial-open affordance via a small wrapper, or open programmatically after mount on mobile).
   - Add bottom padding equal to tab-bar height so the tray's input clears the Study/Ask/Send bar.

3. **Cleanup**
   - Remove now-unused imports and helpers in `console.$code.ask.tsx` (deep-research panel, expound panel, sources drawer, canned suggestions).
   - Leave `useCountryAskThread`, `askCounsel`, `expoundCounsel`, `askCounselDeepResearch` in place — still used elsewhere; just no longer wired to this route.

## Out of scope

- No changes to `AskTheLedger` internals or Chamber 01.
- No backend/server-function changes.
- Desktop Chamber 01 usage unchanged.

## Verification

- On `/console/ATG/ask` (393×852): empty state shows constellation + flag + instruction; tapping the tray input opens the Chamber 01 composer; asking a question streams a grounded answer with citations, mic works, expand/pin/copy work; tray sits above the bottom tab bar with no overlap.
- Chamber 01 (`/instrument`) still renders and behaves as before.
- Typecheck/build clean.
