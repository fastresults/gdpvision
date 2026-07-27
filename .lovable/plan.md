## Goal

Put the eight uploaded op-ed PDFs behind the existing email gate so every landing page delivers its file the moment a reader submits the form.

## What's already in place (verified)

- `/op-eds` index and `/op-eds/$slug` landing pages for all eight pieces, generated from `content/op-eds/*.md`.
- `OpEdGate` four-field form → `requestOpEd` server function → row in `op_ed_requests` → one-hour signed URL from the private `op-eds` storage bucket.
- `requestOpEd` signs the object named by `pdfKey`, i.e. `GDPVision-{NN}-{slug}.pdf`. The eight uploaded filenames match those keys exactly, so no code change is needed for the mapping.

Right now the signing step fails (object missing) and the gate shows "The PDF is being finalised".

## Steps

1. **Upload the eight PDFs** into the private `op-eds` bucket at exactly these keys:
   - `GDPVision-01-national-ledger.pdf` … `GDPVision-08-mandate-compact.pdf`
   (Files are staged from the upload mount, not committed into the repo.)

2. **Confirm objects and keys** by listing the bucket and matching each key against `pdfKey` in `src/lib/op-eds/content.ts`.

3. **End-to-end verification** — for at least two op-eds (one short, one long), drive the live page with Playwright: submit the gate form with a test identity, confirm the response returns a signed URL rather than the "being finalised" note, and fetch that URL to confirm it returns a real PDF of the expected byte size.

4. **Landing-page finish pass** — with real PDFs in place, tighten the last details:
   - Confirmation state reads as a delivery, not a form receipt (title, "Open the PDF" button, briefing CTA).
   - Each `/op-eds/$slug` head has its own title, description, `og:title`/`og:description`, and absolute `og:image`; `/op-eds` index likewise.
   - Index page shows all eight as published with emblems and no dead links.

5. **Cleanup** — remove the test lead rows created during verification so the `op_ed_requests` table only holds real readers.

## Technical notes

- Uploads go through the storage tool against the existing private bucket; access stays gated by the one-hour signed URL issued server-side, so the PDFs are never publicly listable.
- No schema change, no new server function, no change to `scripts/build-op-eds.ts` or the generated content module.
