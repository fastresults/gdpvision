# Make "Brand Building" work like "Presentations"

Right now the **Brand Building** category is treated as a video category (grouped with Past Events). The user wants it to behave **identically to Presentations**: PDF uploads, stored in Supabase Storage, displayed in the same `PdfViewer` with the new page navigation. No brand items exist in the database yet, so there is nothing to migrate.

## What changes

### 1. Reclassify "brand" as a PDF category (not a video category)
- `src/lib/kiosk-types.ts` — remove `"brand"` from `VIDEO_CATEGORIES` so it is no longer treated as a video upload.
- `src/lib/thumbnail.ts` — drop the `brand` exclusions so brand items get a thumbnail (the first-page PNG generated during PDF upload), exactly like presentations.

### 2. Admin: show the PDF uploader on the Brand tab
- `src/routes/admin.tsx` — change the conditional from `categoryTab === "presentations"` to `categoryTab === "presentations" || categoryTab === "brand"` so `<PresentationUpload />` renders for both tabs.
- Pass the active category into `PresentationUpload` so it knows where to file the new row.

### 3. PresentationUpload component accepts a category
- `src/components/admin/PresentationUpload.tsx` — add an optional `category: "presentations" | "brand"` prop (default `"presentations"`), include it in the `FormData` sent to the upload endpoint, and adjust the heading/button copy generically ("Add a PDF").

### 4. Upload endpoint stores the chosen category
- `src/routes/api/upload-presentation.ts` — read `category` from the form, validate it is one of `presentations | brand`, use it for the `sort_order` lookup and for the inserted row. Same `presentations` storage bucket for both (single source of truth, no schema/storage change needed).

### 5. Kiosk viewer renders the PDF for brand too
- `src/components/mobile/MobileKiosk.tsx` — change the PDF gate from `active.category === "presentations" && !!active.pdf_storage_path` to `(active.category === "presentations" || active.category === "brand") && !!active.pdf_storage_path`, so the existing `PdfViewer` (with the new prev/next controls, download, print, open-in-tab) is used for brand items.

### 6. Delete cleanup already works
`items.functions.ts` already removes the row's `pdf_storage_path` from the `presentations` bucket on delete regardless of category, so no change is needed there.

## Out of scope
- No database migration (no existing brand rows, schema already supports `pdf_storage_path` on every category).
- No changes to the `PdfViewer` itself — the recently added page navigation, download, print, and reload controls are reused as-is.
- No changes to the Past Events ("videos") flow.

## Verification
1. Admin → Brand Building tab shows the PDF drag-and-drop uploader (same UI as Presentations).
2. Upload a PDF; row appears under Brand with a generated first-page thumbnail.
3. Open the kiosk, switch to Brand Building, tap the item → the same `PdfViewer` opens with working prev/next, page indicator, download, print, open-in-tab, and reload.
4. Delete a brand PDF from admin → row and stored file both removed.
