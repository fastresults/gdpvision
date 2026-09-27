# Mandate Compact · Step 01 — one intake for files and links

## What exists today
- The drop zone reads PDF, DOCX and TXT files.
- The URL line reads a single web page.
- Gaps: link-only manifestos often point to a party **landing page** that links to the real PDF, a **Google Drive / Dropbox / OneDrive share link**, or a manifesto **split across several pages**. These come back thin and fail with "manifesto too short". PDF reading on the live server is also fragile, and the uploaded file isn't kept for later reference.

## Recommended approach: one "Source" card, two equal ways in
Replace the big drop zone + faint URL line with a single card that has two tabs: **Upload file** and **From a link**. Both end in the same "Reading…" progress and the same review form.

### From a link — smart link reading
1. Paste a link and press **Read**.
2. The system works out what it is:
   - **Direct PDF/DOCX link** → downloads the file and reads it like an upload.
   - **Drive / Dropbox / OneDrive share link** → converts to the direct download and reads the file (clear message if the file isn't shared publicly).
   - **Web page** → reads the page. If the page is short but links to a PDF or to "Chapter/Part" pages, it shows those as a checklist ("We found 1 PDF and 6 chapter pages — read them?") with the most likely manifesto pre-ticked.
3. Multi-page manifestos are stitched together in order, with a page count shown.
4. If a link can't be read (blocked, login-only), the message says so and offers **Upload file** or **Paste text** instead of a dead end.

### Upload file
- Keep drag-and-drop and click to browse; add a visible **Paste text** fallback.
- Save the original file so reviewers can open it later from the compact.

### Both paths
- Show what was read: source (file name or link), pages, characters, and a "View extracted text" button before sign-off.
- The link and extracted text file into the second brain once, deduplicated by link / content (re-reading the same manifesto never makes duplicates).
- Only safe public web addresses are fetched (existing safe-link check).

## Technical details
- `extract.functions.ts`: add a URL resolver — HEAD/content-type sniff; share-link rewrites (Drive `uc?export=download`, Dropbox `dl=1`, OneDrive `download=1`); PDFs/DOCX routed through the file parser; pages via existing Firecrawl scrape with `links`, returning candidate PDF/chapter links when text < ~3,000 chars. New `readManifestoLinks({ urls[] })` stitches selected pages. Validate with `safe-url.ts`.
- Make PDF reading Worker-safe: fall back to Firecrawl/AI-gateway document parsing when `pdf-parse` fails.
- Store uploads in the existing `study-artifacts`-style private bucket via signed URL (no 75 MB base64 post); pass `storage_path` to `upsertCountrySource`.
- UI in `countries.$code.mandate-compact.tsx`: tabbed source card, candidate-link checklist, extracted-text viewer; uses `btn-*` utilities.
- No schema changes expected.
