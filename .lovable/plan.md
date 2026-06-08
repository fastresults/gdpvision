## Plan: Collapsible PDF toolbar

### Behavior
- The PDF viewer's secondary toolbar (title + page nav + reload/open/print/download) is **hidden by default**.
- A new icon button appears in the top navigation bar, immediately to the **left of the Admin button**, only when a PDF item is active.
- Clicking it toggles the PDF toolbar's visibility. Icon reflects state (e.g. `PanelTopOpen` when hidden, `PanelTopClose` when shown).
- Floating page-nav pill at the bottom of the PDF remains as-is, so basic navigation still works while the toolbar is collapsed.

### Changes

1. **`src/components/mobile/PdfViewer.tsx`**
   - Accept a new prop `showToolbar?: boolean` (default `false`).
   - Wrap the existing top toolbar `<div>` in `{showToolbar && (...)}`.
   - Keep keyboard navigation, bottom floating pager, and error/status overlays unchanged.

2. **`src/routes/index.tsx`** (desktop kiosk)
   - Add local state `const [pdfToolbarOpen, setPdfToolbarOpen] = useState(false)`.
   - Reset to `false` whenever the active item changes (so each new PDF starts collapsed).
   - In the top nav bar, render a toggle button immediately before the Admin button. Only show it when the active item is a PDF (`PDF_CATEGORIES.includes(active.category) && active.pdf_storage_path`).
   - Pass `showToolbar={pdfToolbarOpen}` into `<PdfViewer />`.

3. **`src/components/mobile/MobileKiosk.tsx`**
   - Same pattern: add toggle button next to Admin (or the mobile equivalent), reset on item change, pass `showToolbar` through.
   - If the mobile layout has no Admin button in view, place the toggle in the existing top control cluster.

### Out of scope
- No changes to PDF rendering, signed URLs, database, or category logic.
- Floating bottom pager stays visible (it's the lightweight default control).
