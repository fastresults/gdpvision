# Agency Pro Forma — commercial and GDP impact model

A new super-admin-only surface at `/admin/proforma` that models Caribbean-first go-to-market: how many countries adopt per month, at what average revenue, and what that compounds to over quarters, years, 3 years and 5 years — with the correlated GDP/economic benefit delivered to those same countries, computed with the existing value-calculator engine.

## The surface

Route: `src/routes/_authenticated/admin/proforma.tsx`, inside `SuperAdminShell`, added to the `NAV` array as "Pro forma". Agency audience only (the existing `/admin` gate already redirects country users away from non-chamber surfaces).

Three-column workspace, same typographic language as the value calculator:

```text
┌─ Assumptions ────────────┬─ Ledger / charts ─────────┬─ Verdict rail ─┐
│ Market & cohorts         │ Cumulative countries      │ ARR at Y1/3/5  │
│ Adoption pace            │ MRR / ARR curve           │ 5-yr gross rev │
│ ARPU + onboarding fee    │ Quarter & year tables     │ GDP uplift     │
│ Churn, ramp, discount    │ GDP uplift vs revenue     │ Benefit-cost   │
└──────────────────────────┴───────────────────────────┴────────────────┘
```

Verdict rail is sticky on desktop, a sheet on mobile — the same pattern as `VerdictRail.tsx`.

## Assumptions the user controls

Commercial
- Average revenue per country per month (ARPU), single slider — default USD 35k/mo, range 5k–150k.
- One-time onboarding/instrumentation fee per country.
- Annual price escalator (%).
- Monthly logo churn (%) and a contract-length floor.
- Gross margin (%) and optional annual delivery cost per active country, so the rail can show gross profit alongside gross revenue.

Adoption
- Adoption pace: new countries signed per month, expressed as a ramp (months 1–6, 7–12, 13–36, 37–60) rather than one flat number.
- Ceiling per cohort so the curve saturates rather than growing forever.
- Cohorts: **Caribbean** (CARICOM/Caribbean states seeded from the `countries` table, ~16–20) available from month 1; **Expansion** cohorts (Pacific SIDS, West Africa) unlock at a user-set month in years 3–5, each with its own size, ARPU multiplier and pace.
- Stance selector — conservative / central / optimistic — reusing `STANCE_MULTIPLIER` from `src/lib/calculator/model.ts` so the pro forma speaks the same dialect as the public calculator.

Value side
- Chamber adoption depth (how many of the 8 chambers a typical adopter stands up) — drives the GDP model.
- Realisation lag: uplift ramps `RAMP = [0.35, 0.75, 1.0]` from each country's own start month, so a country signed in month 40 contributes almost nothing by month 60.

## Outputs

Per month for 60 months, then rolled to quarters and years:
- New countries, active countries, churned countries.
- MRR, onboarding revenue, total revenue, cumulative revenue, ARR exit run-rate.
- Gross profit at the chosen margin.
- Aggregate annual GDP uplift delivered across active countries, and cumulative uplift.
- **Benefit-to-cost ratio** — cumulative GDP uplift ÷ cumulative fees paid — the single number that says "for every dollar of licence, the region gained N dollars of GDP."
- Milestone cards: end of Q1/Q4, Year 1, Year 3, Year 5.

Charts (SVG, no new dependency, in the house monochrome style):
- Cumulative adoption staircase.
- Revenue area with ARR run-rate line.
- Twin bars: annual revenue vs annual GDP uplift, log-friendly since uplift dwarfs revenue.

Tables: quarterly ledger (20 rows) and annual summary (5 rows), both CSV-exportable and print-friendly.

## How the GDP side is derived (correlation to ROI)

Every adopting country runs through the existing engine in `src/lib/calculator/model.ts` — `computeValue()`, the chamber coefficients, the pools, the stance multiplier, and the 1.2%-of-GDP ceiling. No second, parallel set of economics.

- Caribbean cohort: real nominal GDP and public-expenditure figures pulled from the `countries` table for the states in the cohort, one `computeValue()` run per country, so the aggregate is a sum of actual sovereign economies rather than an average.
- Expansion cohorts: a representative GDP profile per cohort × cohort size, since those states aren't in the corpus yet.
- Each country's uplift is ramped by its months-since-signature and multiplied by the chamber-depth setting.
- The rail then states both sides plainly: agency gross revenue, GDP uplift delivered, and the ratio between them.

## Interrogability

Every derived figure on the surface is wrapped in `<Explain id="...">` per the cardinal rule, with rationales registered in a new `src/lib/explain/proforma-entries.ts`: ARR definition, churn treatment, cohort saturation, the ramp, the GDP ceiling, and the benefit-cost ratio. No bare tooltips.

## Saved scenarios

New table `public.proforma_scenarios` — name, notes, `assumptions jsonb`, `model_version`, `created_by`, timestamps. Migration includes GRANTs, RLS enabled, and policies restricting all access to global admins via `has_role(auth.uid(), 'admin')`. Server fns in `src/lib/proforma/scenarios.functions.ts` (`listScenarios`, `saveScenario`, `updateScenario`, `deleteScenario`) using `.middleware([requireSupabaseAuth])` and re-checking the admin role inside the handler; called from the component with `useServerFn` + `useQuery`, never a public loader.

A scenario picker at the top of the page loads, renames, duplicates and deletes. Assumptions also serialise to the URL so a board view can be shared without saving.

## Technical notes

- New pure module `src/lib/proforma/model.ts` — `ProformaInput`, `runProforma(input, countries)` returning `{ months[], quarters[], years[], milestones, totals }`. Deterministic and side-effect free, so `<Explain>` can restate the arithmetic.
- Caribbean cohort membership resolved from the `countries` table (region/sub-region match) through a server fn, with a hard-coded fallback list so the page renders if the table lacks region tags.
- Buttons use `btn-primary` / `btn-secondary` / `btn-ghost`; only registered `@theme inline` tokens.
- `head()` gets a distinct title/description and `robots: noindex`.
- Run `bun run headers && bun run map` after adding the server-fn module; update `AGENTS.md` §3/§6 with the new surface.

## Order of work

1. Migration for `proforma_scenarios` (table + GRANTs + RLS + admin-only policies).
2. `src/lib/proforma/model.ts` — the engine, reusing calculator coefficients.
3. `scenarios.functions.ts` + Caribbean cohort resolver.
4. Route + panels (`AssumptionsPanel`, `ProformaLedger`, `ProformaCharts`, `ProformaVerdict`), nav entry.
5. `proforma-entries.ts` rationales and `<Explain>` wiring.
6. CSV export, print stylesheet, map/header regeneration.
