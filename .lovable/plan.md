## Goal

Replace the wide "Commencement briefing" strip with two compact buttons sitting to the right of the **Field Programme** tab, and only show them once Brief, Plan (Programme), Participants and Instruments are complete.

## What changes

```text
[ Add synthetic lab ] [ Field programme ]            [ Discovery brief ] [ Presentation ]
──────────────────────────────────────────────────────────────────────────────────────
```

1. **Track row hosts the actions** — `TrackTabs` gains an optional `actions` slot rendered right-aligned (`ml-auto`) in the same flex row, so it stays on the same line on desktop and wraps cleanly on mobile. Buttons use `btn-secondary` per the button contract.

2. **Gate** — in the field stage route, compute `dossierReady` from the existing single read:
   - `gate.committed` (brief written)
   - `gate.planCommitted` / `progress.planActive` (programme approved)
   - `progress.stages.participants.complete`
   - `progress.stages.instruments.complete`

   Until all four are true, no briefing/deck buttons appear. On the `briefing` step, if not ready, the page keeps a short explainer naming the outstanding step rather than an empty rail.

3. **Two entry points**
   - *Discovery brief* — opens the existing `BriefingModal` as today.
   - *Presentation* — opens the same modal but jumps straight to the deck. `BriefingModal` takes an `intent?: "briefing" | "deck"` prop, passed to `BriefingPanel`, which on `intent === "deck"` opens the deck viewer once a composed deck exists for the current briefing version (otherwise it lands on the panel with the compose action highlighted — no behaviour change to composition or provenance gating).

4. **Remove** the full-width "Commencement briefing — the full client-facing account…" strip from the field stage route; its explanatory sentence becomes the buttons' `title`/hint text.

## Technical notes

- Files: `src/components/personas/TrackTabs.tsx` (actions slot), `src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx` (gate + button placement, strip removal), `src/components/personas/field/briefing/BriefingModal.tsx` and `BriefingPanel.tsx` (`intent` prop).
- No server-function, schema, or provenance-gate changes; existing preflight blocking on export/deck stays exactly as-is.
- Presentational only — the deep-link `?step=briefing` route keeps working.
