## What I found on the current homepage

The homepage is a single-page narrative in `src/components/marketing/MarketingHome.tsx` with these sections:

1. **Hero** — "Govern with the whole picture" + rotating existential threats (`EXISTENTIAL_THREATS`).
2. **The moment** — rotating "moment variants" with 3 stat tiles (`MOMENT_VARIANTS`).
3. **The instrument** — **only 6 chambers listed** (Chamber 07 Persona Lab is missing).
4. **Sovereignty** — isolated instance, data ownership, MFA/audit, no trackers.
5. **Provenance** — OPEN Interactive backstory (Caribbean Investment Summit, SKN, SEDE Saint Lucia).
6. **Cabinet briefing** — CTA form.

Route meta (`src/routes/index.tsx`): title is fine; **description is Caribbean/CBI-specific** and doesn't carry the "world's first" positioning or the head-of-government audience.

### Gaps against the positioning you described

| Positioning claim | Present today? |
|---|---|
| "World's first GDP tool" | ❌ Not stated anywhere. |
| Audience = Presidents, PMs, Cabinets (universal, not just Caribbean) | ⚠️ Only in "Cabinet briefing"; hero copy and meta lean Caribbean/CBI. |
| Public + private data differentiation as a headline capability | ❌ Not mentioned. Sovereignty section talks isolation, not the public/private corpus model. |
| **Seven** chambers with distinct outcomes | ❌ Says "Six chambers"; Chamber 07 (Persona Lab) absent. |
| Unrivaled/unprecedented GDP-elevation impact per chamber | ⚠️ Chambers are described by *what they are*, not by *the GDP outcome they produce*. |
| SEO meta reflecting all of the above | ❌ Meta title/description are Caribbean/CBI-scoped. |

## Proposed rewrite

A copy-only + light structural pass on the marketing page. No new design system, no palette change — this is a headline/subhead/body rewrite plus one new chamber tile and one new section.

### 1. Route meta — reposition for global sovereign audience
`src/routes/index.tsx`
- **Title (≤60 chars):** `GDPVision — The world's first GDP-elevation instrument for heads of government.`
- **Description (≤160 chars):** Rewrite to name the audience (Presidents, Prime Ministers, Cabinets), the world-first claim, and the outcome (elevate GDP by turning public + private data into decisions across seven chambers).
- Mirror into `og:*` and `twitter:*` (already wired).

### 2. Hero — global head-of-government framing
`MarketingHome.tsx` HERO block
- New H1 (keep the serif treatment): **"The world's first instrument built to elevate national GDP."**
- New sub-lede (single short paragraph, replaces the rotating body's implicit CBI frame — the rotator stays as evidence): "Purpose-built for Presidents, Prime Ministers and Cabinets. GDPVision converts a nation's public and private data into decisions that measurably lift GDP — across seven chambers of state."
- Keep the existential-threats rotator underneath as *proof of what the instrument is designed to answer* (light re-label from generic "threat" to "The questions on the Cabinet table").
- CTA copy: keep "Request a Cabinet briefing"; secondary link becomes "See the seven chambers ↓".

### 3. New section — "Public data. Private data. One sovereign corpus."
Inserted between **The moment** and **The instrument**. Three-column layout using the existing `SectionHeader` + panel styling.
- **Public corpus** — sourced, graded, and citation-backed data every ministry sees.
- **Private corpus** — Cabinet-only uploads (contracts, memos, MoUs, closes) held under the same provenance discipline, never mixed into the public view.
- **One decision surface** — every chart, scenario, and dossier reads both, with visibility clearly marked and audited.
This is the missing "unique differentiation" the current page never states.

### 4. The instrument — seven chambers, framed by GDP outcome
`CHAMBERS` array in `MarketingHome.tsx`
- **Add Chamber 07 — Persona Lab** (synthetic market research: test policy, incentive, and narrative resonance against modeled citizen/investor personas before spending real capital).
- Change section header from "Six chambers…" → **"Seven chambers, each engineered to move GDP."**
- Rewrite each chamber's `purpose` line so it leads with the **GDP-elevation outcome**, not the mechanism. Examples:
  - 01 Ledger → "The single source of GDP truth every other decision reads from."
  - 02 Portfolio Workspaces → "Every minister sees their contribution to GDP — and the levers that raise it."
  - 03 Scenario Engine → "Rehearse every GDP-moving decision before it costs a cent."
  - 04 FDI Transition Studio → "Replace fragile revenue with durable GDP through an assembled book of investment packages."
  - 05 Narrative Chamber → "Protect GDP by getting to a defensible national position inside a working day."
  - 06 Cabinet Room → "Convert Cabinet time into recorded, tracked commitments that move the GDP dial."
  - 07 Persona Lab → "Test resonance with citizens and investors before policies, incentives, or narratives ship."
- Bullets stay factual; light edits only to remove Caribbean-specific defaults where they read as scope limits (keep OECS as an *example*, not the ceiling).

### 5. Sovereignty — add the public/private line
Add one panel to the existing 4 in `SOVEREIGNTY`:
- **"Public and private, separated by design"** — visibility is a first-class attribute on every row. Private data never enters the public corpus, and Cabinet uploads are gated by country access with a full audit trail.

### 6. Provenance — keep, sharpen one line
Keep the section. Reframe the intro lede so the Caribbean track record reads as **proof of delivery**, not the market ceiling: "…the same team now delivering the world's first GDP-elevation instrument for sovereign governments."

## What is intentionally out of scope

- No visual redesign, no palette or font change, no new components beyond one section block and one chamber tile reuse.
- No claims that require new evidence (I won't invent metrics — the "world's first" line is a positioning claim about the *category*, which matches how you've described it).
- No changes to `EXISTENTIAL_THREATS` / `MOMENT_VARIANTS` data (they still serve).

## Deliverable

A single edit pass on `src/routes/index.tsx` (meta) and `src/components/marketing/MarketingHome.tsx` (hero, chambers array + count, new public/private section, sovereignty addition, provenance lede), plus adding the Chamber 07 entry. No new files required.

## Question before I build

Do you want me to keep the Caribbean/OECS/SKN/Saint Lucia proof points in **Provenance** (as delivery credibility for a global claim), or de-emphasise them so the page reads fully global?
