# Open investor materials in a viewer window on the same page

## Recommended approach
Today, "Open ↗" starts a new browser tab. Instead, clicking it opens a large viewer window over the project page, and closing it leaves you exactly where you were. This covers the Teaser, Memorandum, Data-room index and Deck, and the older versions listed under each one.

## What you will see
- A near-full-screen viewer (about 95% of the screen) with a slim toolbar showing: the document name, the version and its status (Draft / Approved / Superseded), the unverified-number count, and four buttons: **Print / Save PDF**, **Open full page**, **Approve** (only when allowed) and **Close**.
- The document appears inside the viewer exactly as it prints: the one-page teaser, the memorandum pages, the data-room folders, and the deck as 16:9 slides you can step through.
- Moving between versions happens inside the viewer, using arrows or a version picker, so you don't have to close and reopen it.
- Press Escape or click outside the viewer to close it. The browser Back button also closes it, because the viewer is tied to the page address (for example `?tab=materials&view=<packageId>`). That also lets you share or refresh the address and land on the same open document.
- On phones the viewer fills the whole screen.
- The same viewer is used for **Download** on project documents: a PDF opens in the viewer, with Download still available inside it.

## Guardrails
- Printing still produces clean pages. **Print / Save PDF** prints only the document, never the project page underneath.
- The existing full-page print view stays in place, reachable through "Open full page", so nothing breaks.
- Approval rules don't change. The Approve button follows the same two-person rule.

## Technical details
- New `src/components/investments/packages/PackageViewerDialog.tsx`: a shadcn Dialog (`max-w-[95vw] h-[92vh]`, scrollable body). It reuses `getPackage` + `PackageDocument` via `useServerFn`/`useQuery` (key `["package", code, packageId]`), and has an in-viewer version switcher from the panel's existing version list.
- `InvestorPackagesPanel`: replace both `Link target="_blank"` Open actions with buttons that set a `view` search param. Add `view?: string` to the project route's `validateSearch`, and render the dialog when it's set.
- Print from the dialog: a `print-viewer` body class plus `@media print` rules hide everything outside the dialog content and remove the dialog's position and size limits, so the named @page rules in PackageDocument still apply.
- `ProjectMediaPanel`: the Download link in the list becomes View (the existing dialog). The dialog keeps a Download button.
- Verify in Playwright: Open shows the dialog, Escape and Back close it, a refresh with `view=` reopens it, and no console errors appear.
