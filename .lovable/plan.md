## Opposition Intel — guided intake → counter-campaign flow

The intake screen ends after upload. The response plan exists (`generateOppositionResponsePlan`) but is only reachable by clicking a row in the sidebar rail and finding a "Draft response" button in the detail header. Make the counter-campaign the visible product, not a hidden second click.

### 1. Turn upload into a 4-step guided flow on the intake page
Replace the "drop then nothing" layout with a numbered wizard rail at the top of `/admin/countries/$code/narrative/opposition`:

```text
1. Capture  →  2. Analyze  →  3. Counter-campaign  →  4. Publish
   (drop)      (auto)         (McKinsey plan)         (send to Comms Library)
```

- Steps light up automatically as the newest intake advances (`received` → `uploading`/`registering` → `analyzing` → `analyzed` → `plan ready`).
- Each step shows what happens next in plain language, so the user always knows what to expect.

### 2. Auto-generate the counter-campaign — don't wait for a click
- The moment analysis finishes (`status === "analyzed"`), the intake dropzone auto-calls `generateOppositionResponsePlan` for the most recent intake and shows an inline "Drafting counter-campaign…" state.
- A prominent primary CTA (`Generate counter-campaign`) is also always visible for manual re-runs and for older intakes.
- Failure surfaces a clear retry button; no silent dead-end.

### 3. Show the counter-campaign inline on the intake page
Add a `CounterCampaignPanel` directly under the dropzone on the intake page (not only on the detail route). For the currently-focused intake it renders:
- Posture + one-line objective (headline)
- Key messages by audience
- Sequenced actions timeline (Now / 24h / 72h / 1 week)
- Channel plan table (WhatsApp, X, TikTok, radio, press…)
- Risks + success metrics
- Citations chips

This is the McKinsey-grade output the user is asking to see immediately, not buried a click away.

### 4. Make the Recent Intakes list feel like a queue you drive
- Each row shows a status pill (Analyzing / Ready / Plan drafted / Published) and a right-side action button that reflects the next best step: `View plan`, `Draft plan`, `Retry`, `Publish`.
- Clicking a row focuses that intake in the on-page CounterCampaignPanel (no navigation) so the user stays in the guided flow.

### 5. Publish handoff to the Comms Library
Add a `Send to Comms Library` action on the plan panel that creates a draft comms entry seeded from the plan's key messages + channel plan, and links back to the opposition intake. Closes the loop from "meme dropped" → "counter-campaign shipped".

### 6. Copy and empty states
- Rewrite the intake page hero to describe the 4 steps in one sentence.
- Empty state (no intakes yet) shows a short "How this works" strip with the same 4 steps.
- Tooltips on each step explain what the AI is doing and where the evidence comes from (second brain + open-web citations).

### Technical notes
- New component `src/components/narrative/opposition/CounterCampaignPanel.tsx` reused by the intake page and the detail route.
- New component `src/components/narrative/opposition/OppositionStepper.tsx` for the 4-step rail.
- `src/routes/_authenticated/admin/countries.$code.narrative.opposition.index.tsx` composes: hero → stepper → dropzone → CounterCampaignPanel (focused intake) → Recent Intakes queue.
- Auto-plan trigger: in `OppositionIntakeDropZone`, when the mutation flips a queue item to `complete` with `status === "analyzed"`, fire `generateOppositionResponsePlan` and surface a `planStage` in the queue row.
- Add a lightweight polling `useQuery` (interval while any queue item is in `analyzing`/`plan-drafting`) on `getOppositionItem` so the panel and stepper hydrate as the backend advances.
- New server fn `publishPlanToCommsLibrary({ itemId })` that creates a comms draft from the stored plan; reuse existing comms tables.
- No schema changes required for steps 1–5; step 5 uses existing comms draft table.

### Out of scope
- No changes to the analysis prompts or the plan generation model.
- No changes to signal (non-opposition) flows.
