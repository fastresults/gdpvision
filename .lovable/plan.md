
## Goal
Add a prominent, always-visible **"AI Recommend Scenario"** action in the Scenario Engine wizard that, given a plain-language challenge (e.g. "wind down CBI", "increase airlift + rooms", "Cat-4 hurricane hits Q3"), reads the country's second brain and returns a fully-configured scenario — title, horizon, composed playbooks, exact lever positions, rationale, and citations — that the user can preview instantly and one-click apply.

## UX — where it lives

A new **"Ask AI to design this scenario"** primary CTA appears in three complementary places so it's unmissable:

1. **Sticky status bar** (top of live canvas, all steps) — compact `✨ Ask AI` button.
2. **Step 1 hero card** — full "Describe your challenge" prompt box with example chips ("Wind down CBI over 3 years", "Hurricane Cat-4 in Q3", "Double stayover arrivals by Y3", "IMF fiscal consolidation").
3. **Step 2 header** — "Or let AI compose the plays for you" secondary entry that pre-fills the prompt.

Clicking opens a right-side **Recommendation Drawer**:
- Prompt textarea + example chips + horizon hint
- "Generate" streams a McKinsey-style brief with: **Thesis**, **Recommended plays** (multi-select composition), **Lever moves** (table: lever · from → to · Δ pp GDP), **Risks/what must be true**, **Citations**.
- Two actions: **Preview in canvas** (ghost-applies levers so fan chart & compensation ledger bend live without committing) and **Apply scenario** (writes title, horizon, playbook selection, lever values into state, jumps to Step 3).

## AI pipeline

New server fn `recommendScenario` in `src/lib/scenarios/recommend-scenario.functions.ts`:

1. **Context assembly** (server-only): pull country pack — macro snapshot, top sectors, active KPIs, ministry portfolios, existing threats from `existential_threats`, current lever defs + bounds + rationale, playbook catalog (built-in + prior AI plays).
2. **Model**: `google/gemini-3.1-pro-preview` via Lovable AI Gateway (structured output disabled — schema kept constraint-free per gateway rules; fallback parse from `error.text`).
3. **Output schema** (small, flat):
   - `title`, `thesis`, `horizonYears`
   - `playbookIds[]` (subset of catalog) + `newPlaybook?` (if none fits, emit one grounded play)
   - `leverMoves[]`: `{ slug, value, rationaleShort }` — validated against `init.leverDefs` bounds server-side
   - `risks[]`, `assumptions[]`, `citations[]` (from second brain)
4. **Guardrails**: drop lever slugs not in `leverDefs`; clamp values to bounds; if `<3` valid moves, ask AI to retry once with stricter grounding; degrade to plays-only if still empty.

## Preview vs Apply

- **Preview**: sets `ghostPath` from current output, then applies recommended levers into local state without persisting — user sees fan chart bend and compensation ledger update in real time. A "Revert preview" chip appears until Apply or dismiss.
- **Apply**: writes `title`, `horizonYears`, `activePlaybookIds`, `levers`, and appends AI-authored plays via existing `registerAiPlay`; auto-advances to Step 3 with drawer closed.

## Files

**New**
- `src/lib/scenarios/recommend-scenario.functions.ts` — server fn + context assembler
- `src/components/scenarios/AiRecommendDrawer.tsx` — prompt UI, streaming brief, preview/apply
- `src/components/scenarios/AiRecommendButton.tsx` — shared trigger (compact + hero variants)

**Edited**
- `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx` — mount drawer, wire preview/apply handlers, add trigger to sticky bar + Step 1 hero
- `src/components/scenarios/GuidedRail.tsx` — Step 1 hero prompt card, Step 2 header entry
- `src/components/scenarios/AiPlaySuggestions.tsx` — reuse styling patterns

## Technical notes

- Reuse `runLocalEngine` to preview lever moves synchronously — no server round-trip after recommendation returns.
- Citations use existing `<CitedMarkdown>` for the rationale block.
- Empty-lever countries: recommendation drawer detects `init.leverDefs.length === 0` and routes user to Synthesize first, then re-opens with prompt preserved.
- Errors: 429/402 surfaced with plain-language toast per gateway rules; terminal errors don't auto-retry.
