## What's wrong

The two buttons in the track row (`Discovery brief`, `Presentation`) only *open* what already exists. Regeneration is buried: re-assembling the dossier means opening the briefing window and finding "Re-assemble from current state"; re-composing the deck means scrolling past it to "Re-compose deck". There is also no signal that what you're about to open is out of date relative to the brief, plan, participants or instruments that have changed since.

## What to build

### 1. Split buttons in the track row

Each of the two actions becomes a two-part control: the main label opens it, a narrow attached button with a refresh glyph regenerates it.

```text
┌──────────────────────┬───┐ ┌────────────────────┬───┐
│ 📄 Discovery brief   │ ↻ │ │ 🖵 Presentation    │ ↻ │
└──────────────────────┴───┘ └────────────────────┴───┘
```

- Refresh side shows a spinner and disables both halves while running.
- On success the corresponding window opens on the fresh version, so the operator sees the result rather than guessing.
- Errors surface as a small inline note under the row, not a silent no-op.
- Tooltip on the refresh half states plainly what it re-reads ("Re-assemble the dossier from the brief, plan, participants and instruments as they stand now").

### 2. Staleness signal

When a briefing or deck exists but was assembled before the latest change to its inputs, mark the control: a small gold dot on the refresh half plus a tooltip ("Assembled 3 days ago — inputs have changed since"). The deck also goes stale whenever its `briefingVersion` no longer matches the current briefing version — that comparison already exists inside the panel and moves up to the row.

### 3. Confirm before overwriting a sent dossier

If the briefing status is `shared`, regenerating asks for confirmation first ("This dossier was sent to the client on 28 Jul. Re-assembling replaces it with a new version."). Nothing else prompts — regeneration is cheap and expected while the programme is being prepared.

### 4. Same affordance inside the viewers

- **Briefing window**: the existing "Re-assemble from current state" primary stays, but gains the version and staleness line beside it so the operator can tell whether it's worth pressing.
- **Deck window**: add a "Re-compose" action into the deck modal's own header, so it can be regenerated without closing back to the panel.

### 5. Shared behaviour

Both regenerations invalidate their query keys and any dependent readouts, so version chips, dates and the export preflight update immediately without a page reload.

## Technical notes

- Extract a small `SplitAction` control (primary + attached secondary) under `src/components/personas/field/briefing/`, styled with the existing `btn-secondary` / `btn-ghost` utilities — no inline colour classes.
- Lift the briefing and deck queries (`getCommencementBriefing`, `getProgrammeDeck`) and the two assemble mutations (`assembleCommencementBriefing`, `assembleProgrammeDeck`) into a `useDossierActions(projectId)` hook so the route row and `BriefingPanel` share one source of truth and one cache, instead of the panel owning them alone.
- Route file `countries.$code.personas.field.$step.tsx` renders the split buttons through that hook in the `TrackTabs` `actions` slot; `BriefingPanel` consumes the same hook rather than declaring its own mutations.
- Staleness = compare `assembled_at` against the latest `updated_at` among brief, plan, participants and instruments already returned by `getFieldProgress`; if the progress payload lacks a timestamp for a stage, add it there rather than issuing new reads.
- `DeckModal` gains an optional `onRecompose` + `recomposing` prop for the header action.
