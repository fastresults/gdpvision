## Fieldwork desk — guided, instructed, Tier 1

Front UI only. No server functions, no schema, no changes to how waves are derived. Everything below is presentation, copy, and interaction.

### What I saw on the live GRD programme

Reading the actual rendered stage, the desk is *informative* but not *guided*. Concretely:

- Wave 2 is titled `WAVE 2 · DEPTH_INTERVIEW` — a raw database enum is on screen.
- Both waves say **IN THE FIELD** while showing `0/450 returns · 0 invited · 0 opened`. Nothing has been fielded. The badge is not believable.
- The progress bar at 0% renders as a flat grey line indistinguishable from a divider.
- The action row is three visually equal controls — *Issue links to 51 recruited*, *Prepare invitations*, *Close this wave* — with no order, no numbering, and a wave-ending action sitting beside a starting action at the same weight.
- Three collapsed grey all-caps strips stack in a row (*Deploy this instrument*, *Collected elsewhere*, *Paste returns line by line*). Nothing says which one you want, whether anything is inside, or that one of them is the reason the wave is stuck.
- The open participant link is printed twice — once raw in the card, once inside the deploy panel that governs it.
- **There is not a single tooltip in the stage.** The only interrogable thing is the meter.
- Session wave: a *File uploaded material against* dropdown floats above an unlabelled drop zone with no visible relationship between the two.
- Success and error messages land as 12px grey text at the bottom of a panel.

---

### The design position

A wave is a **procedure**, not a panel of options. Every wave gets the same four-beat spine, always in the same order, always numbered, with exactly one live step:

```text
①  Open the field        ── done, ticked, collapses to a line
②  Reach participants    ── LIVE · the only emphasised control on screen
③  Collect returns       ── dimmed until ② has happened
④  Close the wave        ── dimmed until returns exist; confirms before firing
```

Steps behind you compress to a single ticked line. The live step is the only one with a primary button. Steps ahead are visible (so the operator knows the shape of the work) but muted and non-actionable, each with a one-line "unlocks when…".

---

### 1 · A field UI kit (new, shared by both wave types)

`src/components/personas/field/kit/`

- **`Hint.tsx`** — the tooltip primitive this stage is missing. Wraps shadcn `Tooltip`; a small `?` affordance or a wrapped control, hover *and* keyboard focus, tap-to-open on coarse pointers, `aria-describedby` wired. This is for *operating instructions* ("what this button does, what happens after you press it"). It complements `Explain`, which stays reserved for *derivations* ("why this number is this number"). Both appear in the stage; they never overlap in purpose.
- **`StepRow.tsx`** — one numbered beat: index medallion, title, one-sentence instruction, state (`done` / `live` / `locked`), action slot, and a `Hint`.
- **`Meter.tsx`** — honest progress. A track that reads as a track at 0%, a filled portion, a target tick, and a caption. Zero state says `No returns yet · target 450`, not a blank bar.
- **`StatusPill.tsx`** — derived in the UI from the counts already on the board: `Not started` → `Invitations out` → `Returns arriving` → `Target met` → `Closed`. No more "In the field" over an empty wave.
- **`Panel.tsx`** — replaces the bare `<details>` strips. Icon, sentence-case title, one-line purpose, a count/state badge on the right, chevron. Auto-opens when it is the live step; stays closed otherwise.
- **`Flash.tsx`** — replaces the grey trailing `<p>`. Inline banner with tone (working / done / needs attention), an icon, and auto-clear on success.
- **`labels.ts`** — `depth_interview` → `Depth interview`, `focus_group` → `Focus group`, etc. No enum ever reaches the screen again.

### 2 · `WaveShell` rebuilt

Masthead: wave number, humanised method, honest `StatusPill`, title, purpose, audience chips. Then the `Meter`. Then a **"Next move"** strip — the single live instruction with its own `Hint`, and a *Take me there* control that scrolls to and opens the relevant step. Then the numbered ladder.

Every wave card carries a quiet **"What this wave produces"** line so the operator knows why they are doing it (`450 filed returns, tagged to the questionnaire and readable in Evidence`).

### 3 · `CollectionWave` as a ladder

- **① Open the field** — once open, collapses to `Field open · questionnaire live · <date>`.
- **② Reach participants** — the recruited-panel route and the open-link route become two labelled *lanes* inside one step rather than three loose buttons. Primary is `Issue links to 51 recruited`; `Prepare invitations` is explicitly explained by a `Hint` ("mail is not connected, so each invitation is written to the comms log with its own participant link — copy from the register below"). The duplicated raw link is removed from the card body; the link lives only in the deploy lane, with copy-confirmation feedback (`Copied` for 2s).
- **③ Collect returns** — `Deploy this instrument`, `Collected elsewhere`, and `Paste returns line by line` become three `Panel`s nested under this step, each with a badge (`3 staged · 1 to check`, `0 filed`) and a one-line purpose. The drop zone gets a real hover/drag state, an accepted-formats line, and a three-word "what happens next" (`read → mapped → you approve`).
- **④ Close the wave** — never fires blind. A small confirm popover states what closing means (`no further returns can be filed; the wave is scored at 312 of 450`).
- Invitation register gains a compact status legend and per-row copy feedback.

### 4 · `SessionWave` as a ladder

- **① Seat the rooms** — slates from Participants, each with seat count and a `Hint` explaining that these were composed in Stage 02.
- **② Hold the sessions** — the session list becomes a proper roster: date, seats, and a state chip (`Scheduled` → `Held` → `Captured`), with the per-session next action inline and the rest dimmed.
- **③ Capture what was said** — the orphaned *File uploaded material against* select moves *inside* the intake panel as its first field, labelled `Attach to`, so the relationship is unambiguous. Paste-a-transcript and drop-a-recording become two lanes of the same step.
- **④ Close the wave** — same confirm treatment.

### 5 · Tooltips — the instruction layer

Every control that changes state gets a `Hint` written in the house voice: what it does, what it costs, and what happens next. At minimum: open the field, issue links, prepare/send invitations, remind non-responders, publish/withdraw the open link, printable form, return-sheet template, external-tooling export, drop zone, paste returns, schedule a room, mark held, file transcript, commit a staged batch, discard a batch, close the wave. Column mapping and confidence in the staging table get hints explaining that a low score means *check me*, not *wrong*.

Two rationales are added to `src/lib/explain/personas-entries.ts` for the things that are derivations rather than instructions: how a wave's status is decided, and what "target met" counts.

### 6 · Craft pass

- Mobile: action lanes stack, the step ladder keeps its numbering, tap targets clear 44px, the sticky decision bar never covers the last wave's final step.
- Motion: staged batches and newly opened steps fade/slide in at ~150ms; the meter fill transitions. Nothing bounces.
- Accessibility: the ladder is an ordered list, locked steps are `aria-disabled` with a reason, the drop zone is keyboard-reachable, live regions announce staging and filing outcomes.
- Print: hints and chevrons drop out; the ladder prints as a clean procedure record.
- House rules held throughout: `btn-*` utilities only, `paper-*`/`ink-*`/`line-*` tokens only, no raw `JSON.stringify` in JSX, engraving-era restraint — no colour beyond the registered signal tokens.

### 7 · Verification

Typecheck, lint, `bun run check:maps`, then re-drive the live GRD programme with Playwright at desktop and mobile widths and read the rendered ladder back to confirm: no enum leakage, honest status, one live step per wave, and a tooltip on every state-changing control.

### Files

New: `kit/Hint.tsx`, `kit/StepRow.tsx`, `kit/Meter.tsx`, `kit/StatusPill.tsx`, `kit/Panel.tsx`, `kit/Flash.tsx`, `kit/labels.ts`.
Rewritten: `fieldwork/WaveShell.tsx`, `fieldwork/CollectionWave.tsx`, `fieldwork/SessionWave.tsx`, `fieldwork/IngestPanel.tsx`, `DeployPanel.tsx`.
Touched: `FieldworkStage.tsx` (ladder header + next-move handoff), `src/lib/explain/personas-entries.ts` (two rationales).
