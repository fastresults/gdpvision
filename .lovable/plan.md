## Goal

A first-class public page that makes the commercial and institutional case for GDPVision, built from the attached decision paper, in the existing marketing language (serif headlines, mono eyebrows, engraved illustrations, `btn-*` utilities).

## Route and placement (recommendation)

New route: **`/business-case`** — a standalone page, not an op-ed.

Reasoning: the op-eds are *arguments*; this is a *procurement decision paper* aimed at a different reader (Cabinet Secretary, Ministry of Finance, procurement, sovereignty gate). It should be reachable without scrolling a list of nine essays.

Link placement, in priority order:

1. **Primary header nav** in `MarketingShell` — insert "The business case" between "Sovereignty" and "The writing". Header becomes: The Instrument · Sovereignty · The business case · The writing · Request briefing. (Nav is already `hidden md:inline` per item; no mobile-menu regression.)
2. **Home page** — a single link line at the end of the chambers/sovereignty area: "Read the business case →".
3. **Op-eds index** — one line under the author note: "Procuring this? Read the business case →", so the essay reader is handed the decision paper.
4. **Footer** — quiet text link alongside the OPEN Interactive line.

Not recommended: putting it in the signed-in console nav, or gating it behind the op-ed lead form — the whole point is that a procurement officer can read it before giving a name.

## Page structure (`src/routes/business-case.tsx`)

Wrapped in `MarketingShell`, with route-specific `head()` (title, description, og/twitter, canonical, `og:image`).

1. **Masthead** — eyebrow "A decision paper", H1 "The business case for GDPVision", standfirst from the paper's subtitle, byline Adam Anderson / OPEN Interactive, and a `spot` illustration (reuse `section-provenance` or generate one new engraving of a colonnaded ledger building).
2. **Executive summary** — five labelled paragraphs: The decision / Why now / The central argument / On the obvious cheap answer / What is recommended — plus the "What is not claimed" honesty note set apart in a bordered aside.
3. **What is at stake** — six sourced figures as a `NumberTile`-style grid: 50% of revenue (CBI), 90% debt-to-GDP, 226% GDP (Maria), 0 votes (Inclusive Framework), 70% skilled emigration, ~18 months data lag. Each tile carries source + confidence grade inline, matching the paper's own provenance habit.
4. **Instrumentation, not effort** — the three compounding failures (scattered / ungraded / unrehearsed).
5. **The cheap answer, taken seriously** — concede the language-model point, then the seven "cannot by construction" items as a numbered list with `rule` illustration divider.
6. **The alternative is already running** — four uncosted liabilities of shadow AI.
7. **Tier-one test table** — the 8-row test grid (Chat subscription vs GDPVision), rendered as a semantic table styled to the design system, mobile-stacked.
8. **Options appraisal** — three path cards (A subscriptions / B build it / C the instrument) with "what you own after three years": SEATS·SESSIONS·PROSE / CODE·STAFFING·LIABILITY / CORPUS·RECORD·MANDATE.
9. **What the instrument actually is** — eight short chamber paragraphs, generated from the existing `CHAMBERS` array so the copy stays in sync, plus the corpus footnote.
10. **The five approvals** — Principal, Gatekeeper, Technical Validator, Procurement, Sovereignty Gate.
11. **Risks in both directions** — two columns.
12. **Recommended path** — Stage 1 briefing → Stage 2 time-boxed pilot → Stage 3 national deployment.
13. **The test to run before deciding** — the seven questions, numbered, framed as "put these to any AI tool, including ours".
14. **Sources and confidence grades** — full list with grades.
15. **Close** — "Request a confidential briefing" CTA linking to `/#briefing`.

Content lives in `src/lib/business-case.ts` (typed sections, figures, table rows, sources) so the page component stays presentational and the copy is editable in one place. `[ADAM TO CONFIRM]` passages are omitted from the public page.

## Illustrations

Reuse existing engravings where subject-matched (`section-provenance`, `section-sovereignty`, `section-corpus`, `section-counsel`, `section-briefing`) via `<Illustration>` at `spot`/`aside`/`rule` scale — one per section, never in the reading column. Generate at most two new engravings if no existing asset fits (options appraisal, tier-one test).

## Technical notes

- `createFileRoute("/business-case")`, component in the same file, content module under `src/lib/`.
- No database, no server function, no auth — fully static and prerenderable.
- Buttons/links use `btn-secondary` / `btn-primary`; colours limited to registered tokens.
- JSON-LD `Article` block in `head()` for SEO.
- Add a "Download the paper (PDF)" link only if you want the PDF hosted — say the word and I'll upload it to the existing `op-eds` bucket and add an ungated download button.
