# Preload every `/present` web viewer immediately

## Recommendation

Mount every live viewer as soon as `/present` loads and mark each embedded page for eager loading.

There are currently 14 live viewer instances: ten Chamber pages and four published event websites. Each viewer is blocked twice today: its iframe is not created until the section enters view, and the iframe itself uses browser lazy loading. Removing both gates is the most direct and reliable way to ensure pages are ready before the presenter reaches them.

## Changes

1. **Eagerly mount all viewers**
   - Remove the per-section visibility state that controls whether a Chamber or event iframe exists.
   - Keep section visibility only for presentation entrance effects, not network loading.

2. **Request every embedded page immediately**
   - Change the shared viewer from lazy iframe loading to eager loading.
   - Simplify its interface so preloading is the default and cannot accidentally be disabled by a future presentation step.

3. **Preserve loaded viewers**
   - Keep each iframe mounted while moving through the presentation so its page, scroll position, and interactive state are not discarded.
   - Preserve the existing manual reload, expand, collapse, and open-in-new-tab controls.

4. **Keep the experience stable while loading**
   - Retain the individual loading plate and ready indicator for each viewer.
   - Do not block the first presentation slide while the remaining viewers load in the background.
   - Keep the new fit-to-width scaling behavior unchanged.

5. **Verify readiness**
   - On a fresh `/present` load, confirm all 14 iframe requests begin before scrolling.
   - Confirm a late Chamber viewer is already mounted and loaded while the first slide is still visible.
   - Check that moving through the presentation does not trigger duplicate loads, horizontal overflow, console errors, or layout changes.

## Technical details

- This is presentation-only work in the shared live viewer and its two callers.
- Avoid a separate hidden preload copy: it would download each page once in the hidden frame and again in the visible frame, and it would not preserve the preloaded page state.
- Browser scheduling may still prioritize individual network requests, but every viewer will be created and requested immediately rather than waiting for scroll proximity.
