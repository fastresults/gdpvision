
## What you're looking at

The screen labeled **"Studio assets · 4"** is the **Sessions Hub** (`src/components/personas/StudyWizard/SessionsHub.tsx`), rendered on the Persona Lab index route.

It is a **draft library**, not a run output. Every time the wizard modal opens it calls `createDraft(...)` in `src/lib/personas/wizard.functions.ts`, which inserts a row into `persona_study_drafts`. The hub then lists those rows with their last-reached step (`01 · BRIEF`, `02 · OUTCOME`, `03 · CAST`, …), age, and counts.

### Why it appeared instead of a generated study

The current Chamber 07 flow is a **5-step manual wizard** — Brief → Outcome → Cast → Preview → Launch — where each step requires an explicit click:

1. `Enrich into Research Scope` (Gemini)
2. `Build deliverable blueprint` (returns scaffold or AI-enriched blueprint)
3. `Draft cast` (Perplexity fills persona/segment/instrument gaps)
4. `Preview`
5. `Launch` → only here does `commitStudy` persist the real `persona_studies` + personas/segments/instruments and route to the study page.

If you close the modal at any point (or the AI step returns scaffold-only), the draft is saved to `persona_study_drafts` and shows up in the hub — but nothing has been "run." There is currently **no single action that says "take this brief, generate everything, and execute the synthetic analysis."** That is the gap.

The four rows you see are exactly that: three drafts that never reached Launch, plus one recent brief-only draft ("Untitled brief · 14m ago").

---

## Plan — add an "Auto-run" path (AI-first, end-to-end)

Goal: from a single brief (typed / spoken / uploaded), one click generates the scope, blueprint, cast, commits the study, and kicks off the synthetic analysis — with the 5-step wizard preserved for power users who want to intervene.

### 1. New server function: `autoRunStudy` (in `wizard.functions.ts`)
A single server function that internally chains, with progress checkpoints written to the draft after each phase so the UI can stream status:

```
phase 1 · enrichBrief     → brief_scope
phase 2 · enrichOutcome   → outcome_blueprint  (scaffold fallback preserved)
phase 3 · draftCast       → cast_draft (personas/segments/instruments)
phase 4 · commitStudy     → persona_studies row + child rows
phase 5 · runSynthesis    → triggers existing per-instrument synthetic answers
                            (reuses whatever Chamber 07 "Launch" already runs)
```

Every phase writes `draft.autorun_status = { phase, state: 'running'|'done'|'failed', message, ts }` so a poll from the client can render a live progress panel. On any phase failure, the draft stays resumable in the wizard at that step — no dead-ends.

### 2. Corpus-first, deep-research fallback (already the pattern — enforce it explicitly)
`draftCast` already consults second-brain context and only falls back to Perplexity for gaps. Extend the same pattern to `enrichOutcome`:
- Pull relevant sector dossiers, ministry profiles, KPIs, and prior studies for the country before calling the model.
- Only when corpus coverage is thin, add a Perplexity deep-research pass (with `source_url` requirement) to fill missing stakeholder/segment context.
- Store `sources_used: { corpus: [...], web: [...] }` on the draft for provenance.

### 3. UI — "Auto-run" primary action on the Brief step
In `WizardModal.tsx` `StepBrief`, add a second primary button next to `Enrich into Research Scope`:

```
[ ✨ Auto-run full study ]     [ Enrich into Research Scope ]  (advanced)
```

When clicked:
- Modal switches to a full-height **Auto-run console** with the 5 phase rows, each showing spinner → check → summary chip (e.g. "8 personas · 3 segments · 2 instruments").
- On completion, navigate directly to the committed study page — same destination as manual Launch.
- On failure at any phase, show "Resume in wizard at step X" — which just re-opens the modal at that step (leveraging the existing draft).

### 4. UI — make the Sessions Hub self-explanatory
Small copy + affordance changes so it stops looking like "why is this here":
- Rename header: **"Studio assets · 4"** → **"Saved sessions · 4"** with subhead: *"Drafts you started but haven't launched. Auto-run finishes them end-to-end; opening a row resumes the wizard."*
- Add a small **status badge** per row: `Draft` / `Ready to launch` / `Auto-running` / `Committed` (derived from `autorun_status` + presence of a linked `persona_studies.id`).
- Add per-row **"▶ Auto-run"** action that re-enters `autoRunStudy` for existing drafts (starting from whichever phase is incomplete).

### 5. Landing entry point
The `LAUNCH RESEARCH STUDIO` button already opens the wizard on a blank draft. Keep that. Add a companion tile above the hub:

> **New study — auto-run**
> Paste, dictate, or upload a brief. AI generates the scope, blueprint, cast, and runs the synthetic analysis in one pass.

with a compact `MultimodalInput` inline, and a single **Auto-run** button that internally does: `createDraft` → save `brief_raw` + `uploads` → open modal in Auto-run console mode.

### 6. Data
- Add `autorun_status jsonb` and `study_id uuid null` columns to `persona_study_drafts` (nullable, backward-compatible). `study_id` links a committed run so the hub can badge "Committed → open study."
- Migration includes the standard `GRANT` block per project rules.

### Technical notes

- All new AI calls go through the existing Lovable AI Gateway helper (`ai-sdk-lovable-gateway`), reuse the `callStructured` self-repair + fallback path already in `wizard.functions.ts`, and honor scaffold-only degradation so Auto-run never dead-ends.
- `autoRunStudy` is a single `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])` chain; phases are `await`ed sequentially inside the handler. No new endpoints, no edge functions.
- The synthesis phase (persona × instrument answers) reuses whatever the existing manual Launch already invokes — Auto-run just calls it after `commitStudy` resolves.
- Client polls `getDraft` every 1.5s while `autorun_status.state === 'running'` to render the console; on `done` for phase 5 it navigates to the study page.

### Out of scope for this pass
- Cross-study comparison / archive filters in the hub.
- Voice-assistant style back-and-forth clarification (today: single-shot brief → run).
- Editing the blueprint after Auto-run finishes (still reachable through the manual wizard on the draft).

