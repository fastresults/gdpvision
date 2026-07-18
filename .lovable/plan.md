## Chamber 03 · The Scenario Engine — country-scoped, McKinsey-styled workspace

Mirror the Chamber 02 pattern: put the whole scenario experience under `/admin/countries/$code/scenarios/*` with a persistent left rail, a live 3-column builder, an AI-authored executive narrative, and a pinnable comparison drawer. All heavy lifting reuses the server functions already in `src/lib/scenarios.functions.ts` and the `v1_macro` engine — no schema or engine changes.

### Route tree

```text
src/routes/_authenticated/admin/
  countries.$code.scenarios.tsx            layout: header + rail + <Outlet />
  countries.$code.scenarios.index.tsx      empty-state / "New scenario" CTA
  countries.$code.scenarios.new.tsx        live builder (draft)
  countries.$code.scenarios.$id.tsx        saved artifact view (promote, narrate)
  countries.$code.scenarios.compare.tsx    2–4 pinned scenarios side-by-side
```

Chamber 03 launcher card in `src/components/country/ChambersLauncher.tsx` is repointed from `/instrument/scenarios` to `/admin/countries/$code/scenarios` (kind `params`).

### Layout (rail + workspace)

`countries.$code.scenarios.tsx` — same visual grammar as the Portfolios layout:
- `SuperAdminShell` crumbs: Countries → CODE → Scenarios
- Header: country name, "Chamber 03 · Scenario Engine", pinned model version chip (`v1_macro`), and a right-hand `Pinned for compare (N/4) — Compare →` action driven by `localStorage`.
- Left rail (collapsible, persisted in `localStorage`): search box, `+ New scenario`, grouped list `Draft / Shared / Adopted / Archived` with status dot, title, updated date. Hovering preloads the artifact route.
- Right pane: `<Outlet />`.

### Builder — `scenarios.new.tsx` (McKinsey-style, 3 columns)

Column A · **Framing** (sticky, 340px)
- Title (large serif, inline-editable)
- Portfolio scope: ministry select (defaults from `?ministry=`), sector select (optional)
- Horizon slider 1–10 y
- **Playbook presets** (chips that seed lever defaults, purely client-side): "Baseline hold", "CBI wind-down", "Tourism surge", "Agri & Blue Economy push", "Fiscal consolidation". Each preset maps to `{ leverSlug: value }` derived from `init.leverDefs` (default ± bounded step). "Reset to defaults" chip.
- Assumptions textarea (McKinsey "so what" note, saved into `assumptions.note`).

Column B · **Levers** (mid, ~380px)
- Grouped by sector (colour bar from `CANONICAL_SECTORS.cssVar`), collapsible groups.
- Each lever: label, sector chip, min/default/max scale, slider + numeric input, "Δ from default" pill.
- Debounced live re-run (250 ms) via existing `runScenarioEngine` mutation.
- "Lock" toggle per lever (excluded from Reset & Sensitivity sweeps).

Column C · **Projection canvas** (flex-1)
- Hero stat: Year-1 P50 growth vs baseline (delta chip), horizon-end P50, exposure index end-state (when available).
- **GDP fan chart**: existing P10/P50/P90 SVG band, upgraded with axis ticks, baseline reference line, year labels, and hover crosshair that reads out P10/P50/P90 for the hovered year.
- **Sector waterfall**: horizontal bar chart of `sectorImpacts.delta_pp` sorted by |Δ|, sector colour bar, positive/negative on either side of zero axis.
- **Attribution stack**: horizontal 100%-stacked bar showing each lever's `contribution_pp` share of total GDP delta (positive/negative split), with legend.
- **Tornado / sensitivity strip**: for the top 6 attributed levers, run `runScenarioEngine` twice per lever (±20% of bounds range) via `Promise.all`, plot each lever's low↔high GDP range as a horizontal bar centred on the current run. Cached per `{lever, horizon}` in a `useRef`.
- **Executive narrative panel**: "Draft McKinsey narrative" button → new server fn (below). Renders markdown via existing `react-markdown` setup (Situation / Complication / Recommendation / Risks / Watch-list).

Sticky footer action bar: `Save as draft`, `Save & pin for compare`, `Reset`, and (when saved) `Promote → Shared/Adopted`.

### Artifact view — `scenarios.$id.tsx` (rebuilt inside chamber)

Same three-column layout in read-only mode: framing summary, lever settings table, and the full projection canvas populated from `data.results`. Includes:
- Promotion buttons (existing `promoteScenario`) with inline promotion history.
- "Open in builder as fork" → seeds `/scenarios/new` with the artifact's levers via a `?fork=<id>` search param.
- "Pin for compare" toggle.
- Narrative panel: if the artifact already has `assumptions.narrative_md`, render it; otherwise button to generate on demand and PATCH via a small server fn.

### Compare — `scenarios.compare.tsx`

Same visual as the current instrument compare, moved into the chamber and enriched:
- Reads `ids` from search params AND falls back to the localStorage pin set.
- Adds a small overlay fan-chart of the four scenarios' P50 lines.
- "Send to Cabinet Room" ships the top scenario id as an `?scenarioId=` search param into `/admin/countries/$code/cabinet` (existing Cabinet is `/instrument/cabinet` — no change needed for v1; button links to `/instrument/cabinet` for now).

### New server function

`narrateScenario` in `src/lib/scenarios.functions.ts` (thin, additive):
- Input: `{ scenarioId?: string; livePayload?: { countryCode, title, horizonYears, levers, engineOutput } }`.
- Middleware: `requireSupabaseAuth`.
- Loads country context (name + sector composition) + engine output, calls the Lovable AI Gateway (`google/gemini-2.5-flash`, JSON+markdown) with a McKinsey-styled system prompt: Situation → Complication → Recommendation → Downside risks → Watch-list KPIs. Returns `{ narrative_md, generated_at }`. When called with `scenarioId`, persists to `scenarios.assumptions.narrative_md`.
- No schema change (uses existing `assumptions jsonb`).

### Persistence & UX invariants

- Pin set stored at `localStorage["chamber03.pins.${code}"]` (JSON array of ids, max 4). Rail badge reflects count.
- Rail collapse persisted at `chamber03.rail.collapsed.${code}`.
- Every route sets `robots: noindex` and a country-specific title.
- All JSON payloads shown in UI render via `<PrettyJson>` (global rule); Markdown via `react-markdown` + `remark-gfm` (already installed).
- Live engine calls are debounced (250 ms), abortable via mutation reset, and never write to the DB.

### Files touched

New:
- `src/routes/_authenticated/admin/countries.$code.scenarios.tsx`
- `src/routes/_authenticated/admin/countries.$code.scenarios.index.tsx`
- `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx`
- `src/routes/_authenticated/admin/countries.$code.scenarios.$id.tsx`
- `src/routes/_authenticated/admin/countries.$code.scenarios.compare.tsx`
- `src/components/scenarios/GdpFanChart.tsx`
- `src/components/scenarios/SectorWaterfall.tsx`
- `src/components/scenarios/AttributionStack.tsx`
- `src/components/scenarios/TornadoStrip.tsx`
- `src/components/scenarios/PlaybookChips.tsx`
- `src/components/scenarios/NarrativePanel.tsx`
- `src/lib/scenarios/playbooks.ts` (pure preset generators)

Edited:
- `src/components/country/ChambersLauncher.tsx` — Chamber 03 links to new country route.
- `src/lib/scenarios.functions.ts` — add `narrateScenario` server fn only.

### Out of scope (kept for a follow-up)

- Backend changes to `scenarios` schema, RLS, or engine `v1_macro`.
- Removing/moving the existing `/instrument/scenarios/*` tree (keeps working for the country-picker flow); it can be deprecated once Chambers is the default entry point.
- Persisting AI narrative revisions history (v1 stores the latest under `assumptions.narrative_md`).
