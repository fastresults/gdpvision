# Fix: Ask citations and re-asking broken on mobile after an answer

## Root causes (verified in `src/components/ledger/AskTheLedger.tsx` and `src/components/citations/CitationSup.tsx`)

1. **Citations open on hover only.** The inline `[N]` chip is `CitationRef` (lines 692–720), which drives Radix `Popover` open state from `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`. On touch devices these events fire as a synthetic pair on tap and immediately close the popover — the card flashes and disappears, and there is no "Details" affordance to open the full modal. `CitationRow` in the sources list (lines 722–741) is a Popover trigger too, with no dialog path. The nicer `CitationSup` component (which has a proper `onClick` → `Dialog` modal) is not used here.

2. **Composer unreachable after a long answer on mobile.** The mobile panel is `fixed inset-x-0 top-0 z-40` with `bottom: calc(64px + env(safe-area-inset-bottom))` (line 351). Once results, citation list, ExpandActions and (optionally) ArtifactPanel render, the body scroller grows, but the real killer is the iOS keyboard: fixed panels do not shrink with `visualViewport`, so tapping the textarea slides the composer under the keyboard, and any tap outside the textarea (like a citation chip) is intercepted by the keyboard region rather than the trigger.

3. **Nested `role="dialog" aria-modal="true"` on the mobile panel** (line 351) plus a Radix `Dialog` opened from within it can cause Radix's focus/inert handling to fight our custom modal wrapper, occasionally freezing pointer events on the panel after close.

## Changes

### A. Tap-first citations (primary fix)
- Replace inline `CitationRef` and `CitationRow` inside `AskTheLedger.tsx` with the shared `CitationSup` / a new `CitationSourceRow` that both open the existing `Dialog` in `src/components/citations/CitationSup.tsx` on click. Keep hover preview on desktop via `HoverCard` (already inside `CitationSup`), but the click always opens the modal — works identically on touch.
- Update `renderCitations()` (line 621) to render `<CitationSup n={n} citation={mapToCitationRef(cite)} />`. Map `FigureCitation` → `CitationRef` (n, url, title, org, kind, excerpt, published_at).
- Rewrite the sources list at lines 535–543 to use a row component that renders `CitationSup` (or a button that opens the same `Dialog`) so tapping a source in the list opens the details modal instead of a hover-only popover.

### B. Mobile panel: keep composer reachable
- Remove `role="dialog" aria-modal="true"` from the mobile panel wrapper (line 351). It is a page-level surface, not a modal, and it interferes with Radix Dialog. Keep the fixed positioning and z-index.
- Track `window.visualViewport` height in a small effect and set the panel's `bottom` to `max(tabBarGap, window.innerHeight - visualViewport.height + tabBarGap)` so the composer rides above the iOS keyboard.
- Add `scroll-padding-bottom` to the scroll container equal to composer height so the last message is never hidden behind the composer.

### C. Small hardening
- In the citation modal path, stop the tap from bubbling into the underlying `AskTheLedger` panel (add `onPointerDownOutside`/`onInteractOutside` no-op only if we see the panel absorbing focus in QA — otherwise leave default).
- Keep `defaultOpen` behavior for `/console/:code/ask` unchanged.

## Files touched
- `src/components/ledger/AskTheLedger.tsx` — swap `CitationRef`/`CitationRow` for click-to-modal citations; remove `role/aria-modal` on the mobile wrapper; add visualViewport-aware bottom offset.
- (No changes needed in `CitationSup.tsx`; reuse as-is.)

## Verification
- On the `/console/ATG/ask` mobile viewport (393×852), ask a question, wait for citations, tap `[1]` → the source **Dialog** opens, "Open source" link works, closing the dialog returns focus to the panel.
- After the answer renders, tap the composer → keyboard opens, composer stays visible, typing and Send work; tap another citation while keyboard is open → dialog opens above keyboard.
- Desktop right-rail unchanged: hover still previews, click opens the modal.
