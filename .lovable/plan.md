## Plan: Add page navigation to the PDF viewer

### Goal
Let visitors step through slides one at a time with Previous / Next controls, a current-page indicator (e.g. "3 / 12"), and keyboard arrow support — without losing the existing reload/open/print/download toolbar.

### Changes (single file: `src/components/mobile/PdfViewer.tsx`)

1. **Track pages explicitly**
   - Add state: `numPages`, `currentPage` (1-based).
   - In the existing render effect, after each page renders, set a `data-page` attribute on its wrapper div and push it into a `pageEls` ref array so we can scroll to a specific page.
   - Set `numPages` from `pdf.numPages` and reset `currentPage` to 1 on (re)load.

2. **Detect the active page while scrolling**
   - Attach a scroll listener on the scroll container (or use `IntersectionObserver` on each page wrapper) to update `currentPage` to whichever page is most visible. This keeps the indicator in sync when the user scrolls manually.

3. **Add navigation UI**
   - Extend the existing top toolbar with a compact page group on the right side of the title (left of the action buttons):
     - `‹` Previous button (disabled at page 1)
     - `Page X of Y` label (also editable on click — optional, can skip for v1)
     - `›` Next button (disabled at last page)
   - On click: update `currentPage` and call `pageEls.current[idx].scrollIntoView({ block: "start", behavior: "smooth" })`.
   - Add an optional floating bottom-center pill with the same Prev/Next/indicator for easier reach on mobile/kiosk.

4. **Keyboard support**
   - When the viewer container is focused (or always, while mounted): ArrowLeft / PageUp → prev; ArrowRight / PageDown / Space → next. Ignore when target is an input.

5. **Styling**
   - Use existing `--eyeframe-border`, `--eyeframe-surface`, `--eyeframe-accent` tokens to match the current toolbar. No new design tokens.

### Out of scope
- No zoom controls, no thumbnail sidebar, no jump-to-page input (can add later if requested).
- No change to the PDF proxy route or rendering pipeline.

### Verification
- Open a multi-slide presentation in the kiosk flow.
- Confirm: indicator shows "1 / N" on load, Next advances and scrolls, Prev goes back, buttons disable at ends, arrow keys work, indicator updates when scrolling by hand.
