## What's wrong today

The Persona Lab landing page opens as one undifferentiated "Synthetic Persona Lab" funnel (Cast → Group → Rehearse). The full real-world research server layer now exists — programme plans, phases, milestones, participant CRM, comms, instruments, collections, sessions, synthesis — but has no entry point on this page. A user cannot choose, or even see, that there are two ways to run research.

## The idea

Rename the chamber to **The Research Chamber** and split it into two clearly-named tracks a Cabinet can tell apart in one glance:

- **Synthetic Lab** — "Ask a synthetic public. Today." Personas, segments, rehearsals — answers in minutes, no fieldwork.
- **Field Programme** — "Ask the real public. Properly." Brief-derived programme plan, participants, instruments, sessions, evidence — weeks, not minutes.

Both tracks feed the same second brain and can be compared against each other at the end (the calibration function already exists).

## The gate

Track is a property of a **programme**, not a global toggle. Sequence:

```text
Programme index          →  New programme: choose track
   (tabs: Synthetic |         [ Synthetic Lab ]  [ Field Programme ]  [ Both ]
    Field | All)                     │
                                     ▼
                             Brief intake (shared, existing)
                                     │
                     ┌───────────────┴──────────────┐
                     ▼                              ▼
            Blueprint (personas,          Programme Plan (phases,
            segments, studies)            milestones, deliverables)
                     └──────────────┬───────────────┘
                                    ▼
                        Synthesis · field-vs-synthetic calibration
```

Gating rules, all enforced in the UI and mirrored by the existing server checks:

1. No track chosen → nothing downstream is reachable; a track picker is the only action.
2. Track chosen but no committed brief → brief intake only (reuses `ProgramBriefIntake`).
3. Brief committed, synthetic track → Blueprint gate, then Cast / Group / Rehearse as now.
4. Brief committed, field track → Programme Plan derivation gate, then Participants / Instruments / Fieldwork / Evidence.
5. "Both" unlocks each track's rail independently and turns on the calibration view.

Locked steps stay visible but dimmed with a one-line reason ("Commit the brief first"), never hidden — the same pattern the sidebar already uses.

## Copy

- Chamber line: `Chamber 07 · The Research Chamber`
- Headline: **Rehearse it synthetically. Then prove it in the field.**
- Sub: "Two tracks, one evidence base. Cast a synthetic public for an answer today, or run a real programme — participants, instruments, sessions and all — when the answer has to hold up in Cabinet."
- Synthetic card: "Ask a synthetic public — today." · *Minutes · AI-cast voices grounded in the national corpus · Directional, not defensible.*
- Field card: "Ask the real public — properly." · *Weeks · Real participants, consented, tracked to milestones · Citable evidence.*
- Both card: "Rehearse, then verify." · *Run the synthetic pass first, field-test what it predicts, and see where they diverge.*

## Technical section

**Migration**
- `ALTER TABLE public.persona_projects ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'synthetic'` with a check constraint (`synthetic | field | blended`) and a nullable `track_chosen_at`. Existing rows keep `synthetic` so nothing regresses.
- No new tables; the field track's schema landed in `20260801001005_*.sql`.

**Server**
- `projects.functions.ts`: accept and return `track` on `createProject` / `listProjects`; add `setProjectTrack`.
- Header docblocks + `bun run headers && bun run map` after.

**Hooks**
- Extend `useProgramBriefGate` into `useResearchGate(projectId)` returning `{ track, needsTrack, needsIntake, needsBlueprint, needsPlan, blueprintCommitted, planCommitted }` — the field branch reads `getProgrammePlan`, the synthetic branch keeps `getBlueprint`.

**UI**
- `src/components/personas/TrackPicker.tsx` — three cards, the copy above, writes `track`.
- `src/components/personas/TrackTabs.tsx` — Synthetic / Field / Overview tabs, driven by a `?track=` search param, hidden for single-track programmes.
- `StudioStepper` gains a field variant (Brief → Plan → Participants → Instruments → Fieldwork → Evidence); the existing synthetic variant is untouched.
- `countries.$code.personas.index.tsx` becomes a thin router over the gate: track picker → brief → track-specific rail. Programme index gains track chips and a track filter.
- Sidebar in `countries.$code.personas.tsx` renders the synthetic 3-step path or the field 5-step path based on the active programme's track.

**Out of scope for this pass:** the field workspace screens themselves (plan timeline, CRM table, instrument builder, sessions, evidence) — this pass builds the gate, the tabs, the copy and the field rail with each step linking to a placeholder route that states what lands next.
