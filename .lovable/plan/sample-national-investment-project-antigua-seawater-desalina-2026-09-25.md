# Sample national investment project: Antigua seawater desalination plant

Note: "salinization" adds salt, so the project is framed as a **desalination** plant (it removes salt to make drinking water).

## Recommended approach
Build one complete, realistic example for Antigua and Barbuda (ATG) that runs through the real pipeline, not a mock screen. It should show every part working: project record, readiness checks, photos, documents, investor packages and a share link. It is clearly labelled **"Sample project — illustrative figures"** so nobody mistakes it for a real deal.

## What you will see
1. **A project card** called "Crabbs Seawater Reverse-Osmosis Desalination Plant (Sample)" in the ATG investment pipeline. It covers: water sector, a PPP / design-build-operate-transfer structure, the feasibility stage, about US$48m capital cost, 15,000 m³/day capacity, a water-purchase agreement with the utility as the revenue model, IFC category B, solar-powered with climate adaptation alignment, a risk register, and feasibility done / land secured.
2. **A photo gallery** on the project page: a cover image plus 4 images (site aerial, membrane hall, intake and outfall, solar array). These follow the house style: engraved monochrome sketches.
3. **A documents section** with 5 downloadable PDFs, each watermarked "Sample": project concept note, pre-feasibility summary, environmental and social screening, financial model summary, and water-purchase term sheet.
4. **Investor packages** for the sample: teaser, memorandum and deck. They are built with the existing generator, so the unverified-number checks still apply.
5. The sample is left at **Submitted**, so a second admin can show the two-person approval. A share link can only be created after approval, as the database requires.

## Guardrails
- Every figure is marked illustrative, and the sources are real public references on Caribbean desalination costs.
- Compliance fields (beneficial owners, AML) stay in the restricted record with placeholder data.
- A "Remove sample" button deletes the sample project and its files.
- Nothing about this sample is published or shared publicly by default.

## Technical details
- Migration: `investment_project_media` table (id, project_id, country_code, kind image|document, title, caption, storage_path, mime, sort, is_cover, created_by). It includes GRANTs, RLS through `has_country_access`, and write access for admins and those who can approve investments. It also adds `is_sample boolean default false` to `investment_projects`.
- A private storage bucket `investment-media`, served through signed URLs from a server function.
- `src/lib/investments/media.functions.ts`: list, upload, delete (requireAdmin for writes) and `seedSampleDesalination` / `removeSample` (super admin only, idempotent by upserting on title + country + is_sample).
- Images are generated in the engraved style and PDFs are generated server-side with pdf-lib (works on Workers), then uploaded to the bucket.
- UI: `ProjectMediaPanel` (gallery, lightbox, document list with viewer and upload) on the project page. It also adds a "Load sample project" button for super admins in the investments hub header, plus a Sample badge on the card.
- Explain entries for the sample's capex, capacity and tariff assumptions.
- Verify end to end in Playwright on /admin/countries/ATG/investments.
