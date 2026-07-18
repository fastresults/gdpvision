# Ask the Ledger — Elegant Loader + Expand Actions

Two coordinated upgrades to `AskTheLedger` and `ledger.functions.ts`: a phased progress experience that tells the user exactly what's happening (and how long it may take), and a set of one-click follow-ups that turn any good answer into a Policy Memo, Executive Brief, Press Release, Cabinet Talking Points, or Op-Ed.

---

## Part 1 — The Beautiful Loader

### Problem
Today the loader is a single static line ("SEARCHING CORPUS · READING COUNTRY CONTEXT · ESCALATING TO DEEP RESEARCH IF NEEDED…"). On complex questions the request can run 30–90s and the user has no signal about phase, progress, or ETA.

### Design
A ceremonial, phased loader inside the same left-rail card, with:

1. **Phase timeline** — 4 stages rendered as a vertical timeline with dot + label + micro-status:
   - `Searching Corpus` (Tier 1: embeddings + keyword)
   - `Reading Country Context` (Tier 2: KPIs, sectors, dossiers, ministries)
   - `Deep Web Research` (Tier 3: Perplexity — only lights up if invoked)
   - `Synthesizing McKinsey-style answer` (Gemini structured output)
   
   Each row: pending (muted dot) → active (pulsing accent dot + shimmer text) → done (check + elapsed ms). Skipped tiers render as a subtle dashed row labeled "Not needed — corpus was sufficient".

2. **Elapsed + ETA chip** — small monospace chip top-right: `00:14 · est. ~45s`. ETA is derived from question complexity (word count, presence of scenario/forecast keywords like "24-month plan", "if…then", "scenario", "prioritize"): simple → ~15s, medium → ~30s, complex → ~60–90s.

3. **Rotating substatus line** — under the timeline, a McKinsey-toned rotating message (~2.5s cadence): "Ranking 60 chunks by relevance…", "Anchoring to 12 sector dossiers…", "Cross-checking KPI trends…", "Drafting Situation → Answer → So-What…". Purely cosmetic; drawn from a phase-scoped pool.

4. **Progress bar** — thin bar at the bottom of the card that fills based on completed phases (25/50/75/100). Uses `primary` token; no rainbow.

5. **Cancel affordance** — small "Stop" text button appears after 8s. Aborts the fetch via `AbortController`.

6. **Reassurance copy** — after 30s elapsed, a subtle line appears: "Complex questions may take up to 90 seconds. Your research is being grounded in the corpus." — disappears once the answer streams in.

### How phases are driven

Rather than fake progress, wire real signals from the server:

- Convert `askTheLedger` server fn call to stream **NDJSON phase events** over a lightweight route: `POST /api/ledger/ask` (createFileRoute under `src/routes/api/ledger.ask.ts`, auth-gated). Each phase emits `{phase, status, meta}` before the final `{type:'result', payload}` frame.
- Client uses `fetch` + `ReadableStream` reader to update the timeline live. Fallback: if streaming isn't available (build:dev SSR), fall back to the existing non-streaming server fn with only elapsed-time driven phase animation.
- Events emitted:
  - `corpus.start` / `corpus.done {chunks: N}`
  - `country.start` / `country.done {anchors: N}`
  - `web.start` / `web.done {sources: N}` (only if escalated) OR `web.skipped`
  - `synthesize.start` / `synthesize.done`
  - `result` (final payload)

### Component work
- New: `src/components/ledger/AskProgress.tsx` — pure presentational timeline + progress bar + ETA chip, driven by a `phases` prop.
- New: `src/hooks/useAskStream.ts` — wraps the fetch + reader, exposes `{phases, elapsed, etaMs, result, error, cancel}`.
- Edit: `src/components/ledger/AskTheLedger.tsx` — replace the current "SEARCHING CORPUS · …" line with `<AskProgress>`, wire cancel, keep existing answer/citation rendering unchanged.

---

## Part 2 — "Expand this finding" follow-ups

### Problem
Great answers are dead-ends today. Country admins want to convert a strong response into an artifact they can circulate.

### Design
When a result renders successfully (has an answer, ≥1 citation OR ≥1 country anchor), show an **"Expand this"** action rail directly under the answer card. Five cards, each with icon + label + one-line description:

| Icon | Artifact | Output shape |
|---|---|---|
| 📜 `ScrollText` | **Policy Memo** | 1–2 page memo: Context · Options · Recommendation · Risks · Next steps |
| 📋 `ClipboardList` | **Executive Brief** | 1-page: TL;DR · 3 key findings · Decision required · Owner/timeline |
| 📰 `Megaphone` | **Press Release** | Headline · Dateline · Lede · 2 quotes · Boilerplate |
| 🎤 `MicVocal` | **Cabinet Talking Points** | 5–7 bullets in Minister voice, with anticipated Q&A |
| ✒️ `PenLine` | **Op-Ed Draft** | 600-word op-ed voice, first-person, one call-to-action |

Optional 6th: **Save to Chamber → National Ledger Notes** (persists the artifact under the country).

### UX flow
1. Click artifact card → inline expansion beneath the answer (not a new page, not a modal) with a shimmer + phased loader identical to Part 1 (single "Drafting {artifact}…" phase).
2. Result renders in a bordered panel with: artifact title, timestamp, model, **Copy**, **Download .md**, **Regenerate**, **Refine…** (opens a small textarea: "Make it more concise / add fiscal numbers / target IMF Article IV audience").
3. Each artifact inherits the parent answer's citations and re-uses them inline `[N]` with the same popover component.
4. A subtle "Chained from question" breadcrumb shows the original prompt so context is never lost.

### Server
- New server fn `expandLedgerAnswer` in `src/lib/ledger.functions.ts`:
  - Input: `{countryCode, sourceQuestion, sourceAnswer, citations, artifact: 'policy_memo'|'exec_brief'|'press_release'|'talking_points'|'op_ed', refinement?}`
  - Uses the same Gemini model with an artifact-specific system prompt (McKinsey-grade for memo/brief, communications-desk for press/op-ed, cabinet-voice for talking points).
  - Returns `{title, body_md, citations, sources_used}` with the same citation pruning + renumbering already implemented.
- Streaming: same NDJSON pattern, single `drafting` phase.
- Persistence (optional, feature-flagged for now): if "Save to Chamber" is clicked, insert into a new lightweight `ledger_artifacts` table (country_code, question, artifact_type, title, body_md, citations jsonb, created_by, created_at) with RLS via `has_country_access` and the standard GRANTs. Not required for v1 — v1 can be copy/download only.

### Component work
- New: `src/components/ledger/ExpandActions.tsx` — the 5-card rail.
- New: `src/components/ledger/ArtifactPanel.tsx` — inline expanded artifact with actions.
- Edit: `AskTheLedger.tsx` — render `<ExpandActions />` under successful results, manage local `artifacts[]` state (multiple can be expanded and stacked).

---

## Technical Notes

- **Streaming boundary**: server route (`src/routes/api/ledger.ask.ts`, `src/routes/api/ledger.expand.ts`) using `createFileRoute` with a `server.handlers.POST` returning `new Response(stream, {headers:{'content-type':'application/x-ndjson'}})`. Guard with the existing Supabase auth pattern (verify bearer inside handler; these are user-scoped, not `/api/public/*`).
- **Abort**: pass `AbortSignal` from client through fetch; server handler checks `request.signal.aborted` between phases to short-circuit Perplexity/Gemini calls.
- **ETA heuristic**: pure client function `estimateEta(question, hasScenarioKeywords)`; no server call.
- **Accessibility**: timeline uses `role="status"` + `aria-live="polite"`; each artifact card is a real `<button>` with descriptive `aria-label`; Copy/Download announce via `sonner` toast.
- **Mobile**: timeline collapses to a single-line phase pill on `<640px`; expand-actions become a horizontal snap-scroll row.
- **Design tokens**: no hardcoded colors — `primary`, `muted-foreground`, `border`, `accent` from `src/styles.css`. Monospace ETA chip uses the same treatment as existing `SECOND BRAIN · ANTIGUA & BARBUDA` header.
- **No business-logic changes** to the tiered resolver, citation pruning, or model selection — this is presentation + one new synthesis endpoint.

## Out of scope (call out separately if wanted)
- Persisting artifacts to a new `ledger_artifacts` table (mentioned above as optional v1.1).
- Multi-turn conversation memory in the Ask panel.
- Emailing/exporting artifacts to PDF.
