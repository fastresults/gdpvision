## Forensic finding

The database and upload path are now healthy:
- `items_category_check` allows `brand`.
- The Brand Building PDF row exists with `category = brand`, a valid `pdf_storage_path`, and thumbnail status `ready`.
- `/api/kiosk-data` returns the Brand Building item correctly.

The white screen is a desktop viewer routing bug:
- Mobile already treats Brand Building as a PDF and uses `PdfViewer`.
- Desktop only treats `presentations` as PDFs.
- Because Brand Building is not included in the desktop PDF condition, it falls through to the generic iframe renderer.
- The iframe loads the signed PDF URL directly, which produces the browser PDF placeholder/open screen instead of the app’s PDF canvas viewer. On some browsers/devices this appears as a solid white screen.

Key mismatch:
```text
MobileKiosk: presentations OR brand -> PdfViewer
Desktop index route: presentations only -> PdfViewer
Brand on desktop -> iframe -> white/native PDF screen
```

## Fix plan

1. **Unify PDF category detection**
   - Import/use `PDF_CATEGORIES` from `src/lib/kiosk-types.ts` in `src/routes/index.tsx`.
   - Create the same `isPdf` check desktop-side that mobile already uses:
     ```text
     PDF_CATEGORIES.includes(active.category) && active.pdf_storage_path
     ```

2. **Route Brand Building through `PdfViewer` on desktop**
   - Replace the desktop condition that currently only allows `presentations`.
   - Pass the same props already used for Presentations:
     ```text
     url={active.url}
     label={active.label}
     storagePath={active.pdf_storage_path}
     ```

3. **Prevent PDF items from using iframe fallback**
   - Update the iframe fallback condition so any PDF category with a `pdf_storage_path` is excluded.
   - This ensures Brand Building never loads the raw signed PDF URL inside an iframe.

4. **Clean up the viewer block timer**
   - Desktop currently starts the iframe-blocked timer for all non-video resources, including PDFs.
   - Adjust it so the timer only applies to iframe-rendered website/doc resources, not PDF items.

5. **Verify behavior**
   - Open `/` desktop preview.
   - Select `Brand Building`.
   - Click `CBES-Vision Center`.
   - Confirm the custom PDF viewer appears with page controls, download/open/print/reload controls, and rendered pages.
   - Confirm no iframe/native PDF placeholder or white screen appears.

## Scope

No database migration is needed. This is a frontend routing/rendering fix in the desktop kiosk page only; mobile already follows the correct path.