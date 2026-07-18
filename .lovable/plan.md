# Step 2 — Smarter Plays: AI-generated + multi-select

Today Step 2 in `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx` shows five hard-coded playbooks from `src/lib/scenarios/playbooks.ts`. A pick replaces the entire lever map. We'll extend it so ministers can (a) compose multiple plays at once and (b) request AI-generated plays grounded in that country's second-brain (KPIs, sectors, ministries, threats, dossiers).

## 1. Multi-select composition

- Change the `PlaybookCard` state from single `activeId: string | null` to `activeIds: Set<string>` in `GuidedRail.tsx` / the new-scenario route.
- Clicking a card toggles it in/out of the active set. `Baseline hold` is exclusive — selecting it clears others; selecting another play deselects baseline.
- Introduce a deterministic **compose** step in `src/lib/scenarios/playbooks.ts`:
  - `composePlaybooks(defs, playbooks[])` returns a merged `{slug: value}` map.
  - Merge rule: start from defaults; for each selected play, compute its delta from default per lever; sum deltas; clamp to `bounds.min/max`. Conflicting directions net out naturally.
  - Expose per-lever attribution (which plays moved it, by how much) so Step 3's consequence chips can show "Tourism surge +2, Fiscal consolidation −1".
- Show a compact "Stacked plays" strip above the cards with removable chips and a "Clear" affordance.
- Persist `selected_playbook_ids: string[]` on the scenario draft (extend `saveScenario` payload's `assumptions` blob — no schema change needed) so reload restores the composition.

## 2. AI-generated plays (context-aware)

New server function `suggestPlaybooks` in `src/lib/scenarios/suggest-playbooks.functions.ts` (client-safe path, `requireSupabaseAuth`):

- **Inputs**: `countryCode`, `ministrySlug?`, `sectorCode?`, current `leverDefs` (slug, bounds, sector_code, response_fn_ref), and the user's optional freeform prompt ("What if we lean into blue economy and cut CBI?").
- **Context assembly** (server-side, RLS-scoped): pull compact snapshots from the existing corpus —
  - top KPIs + trend from `country_kpis` / `country_kpi_points`
  - sector shares from `sector_dossiers`
  - active existential threats (`src/lib/existential-threats.ts`)
  - ministry mandates for the current `ministry` search param
  - recent narrative signals (P1/P2 only) for the country
- **Model**: Lovable AI Gateway via the shared helper (`google/gemini-3.5-flash` for speed; escalate to `google/gemini-3.1-pro-preview` when the user clicks "Deeper suggestions"). Use `Output.object` with a small, constraint-free schema `{ plays: [{ id, label, blurb, thesis, lever_moves: [{slug, direction: "up"|"down", magnitude: 0..1}] }] }`. Guard with `NoObjectGeneratedError` fallback per the AI SDK rules.
- **Post-processing**: map `lever_moves` → concrete `{slug: value}` using each lever's bounds (magnitude scales the range from default, same math as `nudge()` in `playbooks.ts`). Drop moves whose `slug` isn't in `leverDefs`.
- **Grounding**: return `citations[]` (KPI ids, sector codes, signal ids used) so the play card can show a "Why this play" popover.
- **Caching**: cache by `(countryCode, ministrySlug, sectorCode, leverDefsHash)` in a lightweight `scenario_play_suggestions` table (24h TTL) to avoid re-billing on every visit. Migration includes GRANTs + RLS scoped by `has_country_access`.

## 3. UI additions in Step 2

- New sub-section **"AI-suggested plays"** below the preset grid:
  - Loads 3 suggestions on mount (Suspense + `useSuspenseQuery`), with a "Regenerate" button and an optional prompt textarea ("Focus on… / Avoid…").
  - Each AI card mirrors `PlaybookCard` visual language but marks provenance with a small "AI" chip and a "Why this play" hover (uses `ExplainHover`) rendering the thesis + citations via `CitedMarkdown`.
  - Selecting an AI play adds it to the same composition set as presets.
- Empty/failure states: if the gateway 429/402s, show the presets only with a subtle "AI suggestions unavailable — showing presets" note (no crash).

## 4. Downstream wiring

- `GuidedRail` passes the composed lever map to the existing preview mutation — Step 3 keeps working unchanged.
- `LeverRow` consequence chips gain a secondary line "from: Tourism surge, Fiscal consolidation" when attribution is present.
- Save flow stores `assumptions.selected_playbook_ids` and `assumptions.ai_playbooks` (the generated definitions) so the saved scenario is reproducible even if suggestions change later.

## Technical notes

- Files touched: `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx`, `src/components/scenarios/GuidedRail.tsx`, `src/components/scenarios/PlaybookCard.tsx`, `src/components/scenarios/LeverRow.tsx`, `src/lib/scenarios/playbooks.ts`, `src/lib/scenarios.functions.ts`.
- New files: `src/lib/scenarios/suggest-playbooks.functions.ts`, `src/lib/scenarios/suggest-playbooks.server.ts` (context assembly + Gemini call), `src/components/scenarios/AiPlaySuggestions.tsx`, one migration for `scenario_play_suggestions`.
- No changes to Chamber 03 saved-scenario schema beyond the `assumptions` jsonb blob.
