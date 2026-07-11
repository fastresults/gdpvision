
## Alignment note

The PRD (§16) is prescriptive about the marketing site: it is **deliberately lean** — six sections, one CTA (confidential Cabinet briefing), no pricing, no trial, no trackers, sub-1s LCP. My previous plan proposed 13 marketing routes; that overshoots §16. This revised plan matches §16 exactly and pushes optional depth pages to P1.

One ambiguity: §16 says "the five chambers, each one panel," but §6 defines **six** chambers (Ledger, Portfolio Workspaces, Scenario Engine, FDI Studio, Narrative Chamber, Cabinet Room). Plan uses six panels and flags this for the user to confirm.

## Scope (P0, matches PRD §16)

Single scrolling route at `/` with six sections and a briefing form. Kiosk at `/kiosk` untouched.

1. **Hero** — the National Signature ring **assembles on load** (the one sanctioned page-load moment, §16.1, §11) over headline "Govern with the whole picture." Sub-line names the moment in one factual sentence about the EU CBI wind-down. Wordmark top-left, single primary CTA "Request a confidential Cabinet briefing" (anchors to §6 form).
2. **The Problem** — the wind-down stakes as **sourced numbers** in the number-treatment (large Fraunces numeral + small Plex Mono unit + confidence grade badge). No adjectives. Citations render as small mono footnotes with source and vintage. (PRD §2.1, §10.4.)
3. **The Instrument — the chambers** — six panels (Ledger, Portfolio Workspaces, Scenario Engine, FDI Studio, Narrative Chamber, Cabinet Room), each Paper aesthetic, hairline rules, 2px sector-hue leading accent bar, one-sentence purpose + 2–3 capability bullets. No screenshots in v1 (placeholders will read as SaaS). (§6, §10.5.)
4. **Sovereignty** — sovereign-instance promise stated plainly: one isolated deployment per nation, government owns the data outright, regional/EU hosting options, MFA, no third-party trackers ever. (§14.)
5. **Provenance** — OPEN Interactive's regional record: 2009–2026, Caribbean Investment Summit franchise, national digital infrastructure for the Government of St. Kitts & Nevis, sovereign relationships across the OECS, and **SEDE — the working Saint Lucia prototype** as proof of craft (§2.2, §17 Phase 0).
6. **Single CTA — "Request a confidential Cabinet briefing"** — short, dignified form: name, role, government/nation (dropdown from CARICOM+OECS registry per §7.9 FR-PL-01a), work email, message. Success state: "Received. OPEN will respond within one working day." No pricing page, no trial, no chat widget (§16).

Footer: OPEN Interactive credit, classification line ("Confidential — Government briefing use"), and small `#status` / `#methodology` / `#privacy` anchors (stub sections, one paragraph each).

## Design system (locked to PRD §10)

Implemented as CSS tokens in `src/styles.css` `@theme` so components carry no hex literals.

- **Palette:** `ink-950 #08111F`, `ink-900 #0D1B2E`, `ink-700 #1E3350`, `ink-500 #48607F`, `ink-300 #9DAEC2`, `paper-0 #FCFCFA`, `paper-100 #F4F4EF`, `line-200 #E3E4DD`, `gold-500 #B98A2F`, `gold-300 #D9B866`, `signal-positive #2E7D5B`, `signal-negative #B3402F`, `signal-caution #C07A1A`, `scenario-tint #5B4FA8`, `narrative-500 #8E2F3C`, `draft-state #7A6A8F`.
- **Sector Spectrum (12 hues, Appendix A)** as `--sector-01 … --sector-12`, used by the Signature ring, chamber accent bars, and any future chart.
- **Type:** Fraunces (display serif, opsz 72, SOFT 0, WONK 0), IBM Plex Sans (UI), IBM Plex Mono (all numerals — tabular lining figures mandatory). Loaded via `<link rel="preconnect">` + `<link rel="stylesheet">` in `__root.tsx` head (per Tailwind v4 rule: never `@import` remote URLs in styles.css).
- **Scale:** 12 / 13.5 / 15 / 17 / 21 / 27 / 34 / 43 / 54 / 68 / 96. Line-heights per §10.4.
- **Layout:** 12-col, 1280 canvas, fluid to 1920 and 1024 min; 8px base; section rhythm 64/96.
- **Panels:** borderless white with `line-200` hairlines and 2px sector-hue leading accent bar. No filled header bars. No reverse-out white on dark. Paper mode only on marketing (Chamber dark mode is product-only, §10.1).
- **Iconography:** custom 1.5px stroke line icons on a 24px grid; no filled icons except status dots. Where icons are needed, use `lucide-react` stroke-only with `stroke-width={1.5}`.
- **Gold discipline:** used only on the CTA button and one Provenance mark. Never more than 3 gold moments on any viewport (§10.2).
- **Banned:** tropical/beach clichés, startup gradients, glassmorphism, decorative 3D, neon, template SaaS hero (§10.1).

## Motion (PRD §11)

Motion tokens (durations/easings) added to `styles.css`. Two moments only on marketing:

- **Signature ring assembly** on hero load: 12 sector segments draw in in sector-order over ~1.2s with the wordmark fading in after (`dur-signature`). Single per-session play; skipped on repeat via `sessionStorage`.
- **Count-up** on the Problem section's three headline numbers when they enter the viewport (`IntersectionObserver`), Fraunces numeral with tabular Plex Mono unit.

`prefers-reduced-motion`: ring segments fade in simultaneously at 120ms; count-up replaced by instant values (§11.4). Every meaning has a static equivalent.

Performance budget (§16, §11.5): transform/opacity only, no layout thrash; **sub-1s LCP** target — no web fonts blocking LCP (font-display: swap; hero headline uses `font-display: optional` on Fraunces or a system-serif fallback stack sized to prevent CLS).

## Components (`src/components/marketing/`)

- `MarketingShell.tsx` — top wordmark rail (no nav menu — single-page site), footer.
- `Wordmark.tsx` — GDPVISION in Fraunces, letterspaced, `ink-950`, never gold.
- `SignatureRing.tsx` — SVG generator: takes an array of 12 `{ sector, share }` and renders a circular band; the marketing master mark uses the **idealized balanced ring** (§10.3). Assemble animation + reduced-motion path.
- `NumberTile.tsx` — large Fraunces numeral, Plex Mono unit, confidence grade badge (A/B/C/D per §7.1 FR-NL-04), citation footnote slot.
- `ChamberPanel.tsx` — hairline-bordered white panel, 2px leading sector-hue accent bar, title + one-line purpose + bullets.
- `HairlineRule.tsx`, `SectionHeader.tsx`, `AccentBar.tsx`, `Citation.tsx`, `ClassificationStrip.tsx`.
- `BriefingForm.tsx` — the CTA form; posts to `submitBriefingRequest` server fn; nation dropdown seeded from the CARICOM/OECS registry constant.
- `CaricomRegistry.ts` — the 15 CARICOM full members + 5 associates + OECS list per FR-PL-01a, as a typed constant reused later by the product.

Delete `src/components/marketing/MarketingHome.tsx` after `/` is rebuilt.

## Route + SEO

Single route file `src/routes/index.tsx` with `head()`:

- `<title>` "GDPVision — Govern with the whole picture" (<60)
- meta description one factual sentence naming the CBI wind-down and the sovereign instrument (<160)
- matching `og:title` / `og:description`, `og:type=website`, `twitter:card=summary_large_image`
- `og:image`: a server-generated cover of the Signature ring on Paper (built as a static asset via `imagegen`, absolute https URL) — set on this leaf route, **not** on `__root`
- canonical `https://gdpvision.com/`
- JSON-LD `Organization` for OPEN Interactive with GDPVision as a `subOrganization` / product

Root `head()` in `__root.tsx`: generic app title only, no `og:image` (per Lovable rule — root concatenates into every match).

Robots + sitemap: `public/robots.txt` allowing all; `public/sitemap.xml` listing `/`. Section anchors (`#problem`, `#chambers`, `#sovereignty`, `#provenance`, `#briefing`) for internal deep-linking; hash anchors are acceptable here because everything genuinely belongs on this one page (§16).

## Backend (briefing form only)

Migration creates `public.briefing_requests`:

```
id uuid pk default gen_random_uuid()
created_at timestamptz not null default now()
name text not null
role text not null
government text not null            -- ministry / office
nation text not null                -- CARICOM/OECS registry code
email text not null
message text
status text not null default 'new'  -- new | acknowledged | scheduled | closed
user_agent text
```

Grants + RLS in the same migration (per Lovable rule):

- `GRANT INSERT ON public.briefing_requests TO anon` (form is public)
- `GRANT SELECT, UPDATE ON public.briefing_requests TO authenticated`
- `GRANT ALL ON public.briefing_requests TO service_role`
- Enable RLS; policies: anon `INSERT` allowed; authenticated `SELECT`/`UPDATE` only via `has_role(auth.uid(),'admin')` (uses the standard `app_role` enum + `user_roles` table + `has_role` security-definer function per the roles rule; create these if not present).

Server fn `submitBriefingRequest` in `src/lib/briefing.functions.ts`:

- `createServerFn({ method: "POST" })` with Zod validator (name/role/government/nation/email required; email format; nation ∈ registry; message ≤ 2000 chars; honeypot field rejected).
- Simple rate limit: reject if the same email + nation submitted in the last 60 seconds (server-side check).
- Inserts using the server publishable client (RLS-satisfied anon insert). Returns `{ ok: true, id }`.
- No third-party analytics or trackers anywhere (§14.6). Errors log server-side only, not to the client.

## Accessibility (PRD §13)

- WCAG 2.2 AA verified; all headline numbers meet AAA contrast.
- Semantic sections, single `<h1>` (hero), landmarks (`<header>` / `<main>` / `<footer>`), skip link.
- Signature ring: `role="img"` with an `<aria-label>` naming the sectors and shares; a hidden `<table>` equivalent for screen readers (§13.3 requirement extended to marketing).
- Sector hue never carries meaning alone — every chamber panel is labeled and legend-ordered (§13.4).
- Full keyboard operability on the form; visible focus rings in `gold-500` (§10.2 focus token).

## Verification

1. `bun run build` clean; no unresolved imports.
2. Playwright (headless, viewport 1280×1800): load `/`, screenshot hero (verify ring drew), scroll to Problem/Chambers/Sovereignty/Provenance/Briefing, screenshot each; submit the form with a valid payload; confirm row appears via `supabase read_query`.
3. Playwright with `prefers-reduced-motion: reduce`: verify no assembly animation, ring visible statically.
4. Lighthouse locally (or a manual LCP check via Playwright's `performance` API): confirm LCP < 1s on the hero.
5. `/kiosk` and `/kiosk/admin` still load kiosk data (regression check).

## Out of scope (P1 / later)

- Depth pages for each chamber (§16 explicitly says one panel each on the marketing site).
- Live per-nation Signature rings (§10.3 says instance marks are generated per government; the marketing site uses the idealized master mark).
- Chamber (dark) mode toggle — product only (§10.1).
- Multilingual (English at GA per §13.5; string architecture ready is a product concern, not marketing v1).
- Public methodology "Codex" (§7.9 FR-PL-05 is an in-product handbook, not marketing).
- Pricing, trial, chat widget — explicitly forbidden by §16.

## Question flagged for you

§16 says "the five chambers, each one panel," but §6 defines six chambers. Plan currently shows **six** panels to match the product architecture. Say the word if you want five (which set to drop) or want me to keep six.
