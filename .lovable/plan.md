
# Streamline AI Wiring: Navigation Index & Manifest

## Problem

The codebase has grown to 7 chambers, ~20 onboarding stages, dozens of server functions, and heavy cross-cutting flows (opposition, narrative, ledger, console). Each AI turn burns tokens re-discovering: "where does X live?", "which server fn writes to table Y?", "what route renders component Z?". No stable map exists — the AI keeps re-grepping the same paths.

## Goal

A durable, auto-maintained set of index files at the repo root that the AI reads FIRST on every task, so it goes straight to the relevant files.

## Deliverables

### 1. `AGENTS.md` (root) — the AI's front door

A single always-read file that answers the top 20 "where is X" questions:
- Chamber → route + primary components + server fn module
- Feature (Opposition, Concierge, Onboarding stage N, Ask thread) → files
- DB table → owning server fn module + RLS notes + related UI
- Conventions: button contract, PrettyJson rule, dedup rule, public/private visibility
- "Don't touch" list (generated files, integration-managed files)

Kept under 400 lines. Links out to deeper maps.

### 2. `docs/map/` — per-domain module maps

One short markdown per domain, each ~50–100 lines:
- `map/chambers.md` — chamber ↔ route ↔ components ↔ server fns
- `map/onboarding.md` — each of the 20 stages: research fn, commit fn, table(s), UI panel
- `map/corpus.md` — searchers, second-brain tables, dedup keys
- `map/server-fns.md` — every `.functions.ts` with one-line purpose + tables touched
- `map/routes.md` — route tree grouped by persona (marketing, console, admin, instrument, narrative)
- `map/tables.md` — table → RLS helper → owning module → grants

### 3. `scripts/build-map.ts` — the generator

A single Bun script that regenerates `docs/map/server-fns.md`, `routes.md`, and `tables.md` deterministically from source:
- Walks `src/lib/**/*.functions.ts`, extracts exports and JSDoc top-line
- Walks `src/routes/**` for `createFileRoute` paths
- Parses `supabase/migrations/*.sql` for `CREATE TABLE public.*` + grants

Run via `bun run map`. Adds a pre-push friendly `bun run map:check` that fails if maps are stale.

### 4. File-header convention

Add a 3-line docblock to every server-fn module and non-trivial component:
```
// @domain onboarding/stage-12
// @tables capital_flow_nodes, capital_flow_edges
// @ui admin/countries/$code/onboard (Stage 12 panel)
```
The generator harvests these. Cheap to add during normal edits; huge payoff for grep-free discovery.

### 5. Update the "always in context" memory

Add to `mem://index.md` Core:
- "Read `AGENTS.md` before searching. For domain work, read the matching `docs/map/<domain>.md` next."

That single line changes AI behavior on every future turn.

## Rollout (phased, low-risk)

1. **Phase 1 (this task):** Write `AGENTS.md` + `map/chambers.md` + `map/onboarding.md` + `map/corpus.md` by hand from current knowledge. Add the memory rule. — Immediate win.
2. **Phase 2:** Build `scripts/build-map.ts`; generate `server-fns.md`, `routes.md`, `tables.md`. Commit initial output.
3. **Phase 3:** Backfill `@domain/@tables/@ui` headers across existing server-fn modules (mechanical, batchable).
4. **Phase 4:** Optional — wire `bun run map:check` into a lint step so maps never drift.

## Non-goals

- No runtime behavior change. Pure documentation + tooling.
- Not replacing memory files; complements them (memory = rules, maps = topology).
- Not introducing Graphify or any external service — plain markdown + one script.

## Success signal

Next time you ask "where does opposition wire into comms?", the AI opens `AGENTS.md` → `map/chambers.md` → jumps to `opposition-plan.functions.ts` in one hop, not five greps.

---

Want me to start with **Phase 1 only** (hand-written AGENTS.md + 3 domain maps + memory update) so you see value this turn, then decide about the generator?
