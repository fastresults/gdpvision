# GDPVision — Sovereign Pitch Deck (PPTX)

A 14-slide, editable PowerPoint deck aimed at Heads of Government (Presidents, Prime Ministers). Content is scraped from the live GDPVision app (public marketing site + product surfaces already in this repo) and shaped into a cabinet-grade narrative.

## Source of truth

- Scrape `https://gdpvision.com` (hero, positioning, chamber copy, sovereignty panel) via Firecrawl (`markdown` + `screenshot`).
- Cross-reference in-repo canonical copy that already drives the marketing site: `src/components/marketing/MarketingHome.tsx`, `ChamberPanel.tsx`, `WhyThisNumber.tsx`, `SectionHeader.tsx`, and the seven chamber launcher descriptions in `src/components/country/ChambersLauncher.tsx`.
- Reuse existing brand assets: `src/assets/chambers/chamber-01…07.jpg` and `src/assets/gdpvision-og.jpg` for chamber and title visuals.

## Deck outline (14 slides)

1. **Title** — "GDPVision — the world's first GDP-elevation instrument." Wordmark, dark sovereign cover.
2. **The mandate** — Why heads of government need a purpose-built instrument now (growth, resilience, sovereignty).
3. **The instrument** — One-line definition + the Second Brain as sovereign corpus (public + private data).
4. **How it works** — Deep research → corpus → seven chambers → cabinet decisions (single diagram).
5. **Chamber 01 — National Ledger.** Hero image + 3 outcomes.
6. **Chamber 02 — Portfolio Workspaces.** Delivery dossier for every ministry.
7. **Chamber 03 — Scenario Engine.** Sovereign sliders, fan charts, compensation ledger.
8. **Chamber 04 — FDI Transition Studio.** Threat composer + strategy canvas.
9. **Chamber 05 — Narrative Chamber.** Signal to statement inside a working day.
10. **Chamber 06 — The Cabinet Room.** Situation board, decision queue, session mode.
11. **Chamber 07 — Persona Lab.** Synthetic market research for policy.
12. **Sovereignty & trust** — Public vs. private data, by-invitation access, evidence-grade citations, RLS.
13. **What changes in 90 days** — Corpus stood up, chambers live, first cabinet session, first published narrative.
14. **Close & call to action** — "Elevate your GDP." Contact + `gdpvision.com`.

## Design system

- Palette: **Midnight Executive** — navy `1E2761`, ice blue `CADCFC`, gold accent `C9A24B`, ink `0B0B0F`, paper `F7F5EF`. Dark cover + dark closing; light interior "sandwich".
- Type: Georgia (headers, serif for sovereign tone) + Calibri (body). Titles 48–54pt, body 24–28pt, chrome 20pt — per the slides-app defaults.
- Motif: thin gold rule under kickers; chamber cards use the real product screenshots as half-bleed hero images (left), copy on right.
- 1920×1080, US Letter landscape aspect, 0.5" margins, base64-embedded images so PDF renders identically.

## Build steps

1. **Scrape** `https://gdpvision.com` via Firecrawl → save markdown to `/tmp/gdpvision-scrape.md`.
2. **Assemble copy pack** in `/tmp/deck-content.json` merging scrape + repo canonical strings (so wording matches the live product).
3. **Generate** `/mnt/documents/gdpvision-pitch.pptx` with `pptxgenjs` following the `skill/pptx` reference (semantic classes, no unicode bullets, dual-width tables if used, ImageRun-style base64 embeds).
4. **QA** — render to PDF via LibreOffice, `pdftoppm` to JPEGs, inspect every slide for overflow / contrast / placeholder text; iterate until clean.
5. **Deliver** as a `<presentation-artifact>` (PPTX) so you can download and edit.

## Deliverable

- `/mnt/documents/gdpvision-pitch.pptx` (editable, 14 slides, ~2–3 MB with embedded imagery).

## Open assumptions (flag if you want changes)

- No client logo, no case-study numbers, no pricing slide — say the word and I'll add a "Proof & precedent" and/or "Engagement model" slide (deck grows to 15–16).
- Cover uses the GDPVision wordmark only; no PM-specific personalization. If you want a country/PM name on the cover, tell me which.
