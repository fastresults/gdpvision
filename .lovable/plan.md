## Diagnosis

The UI did not change because the interactive slider system is wired to `public.levers`, but ATG still has **zero committed lever rows**. The AI synthesis work created **two ATG lever drafts with 12 proposals each**, but they remain in `draft` status, so the Scenario Engine loader returns `init.leverDefs.length === 0`. That is why Step 4 says “Levers are at default — no movers,” and why no sliders appear.

There is also a second issue: the live preview currently showed a blank body in one viewer, so I will include route resilience in the fix rather than only fixing data flow.

## What went wrong

1. **Drafts were generated, not activated.** The system asks the admin to review and commit synthesized levers, but the UI does not make that conversion obvious or automatic enough.
2. **Step 2 still allows “plays” with zero underlying levers.** Play cards can be selected, but they cannot move anything until lever definitions exist.
3. **Step 3 hides the real problem behind a manual CTA.** It tells users to synthesize, but if drafts already exist, it does not surface them as “ready to commit.”
4. **The right canvas renders an empty-lever state instead of driving users to the missing action.** The product feels broken even though data exists one layer earlier.

## Fix plan

### 1. Add a fast “drafts waiting” path
- Add a server function to list the latest lever drafts for a country.
- Add a server function to commit the latest usable draft for the current country.
- If ATG has drafts with proposals, Step 3 should show: “12 AI levers are ready — activate sliders.”
- One click commits them into `public.levers`, invalidates `engine-init`, seeds defaults, and immediately shows sliders.

### 2. Make zero-lever countries self-heal in the flow
- In Step 2, when a user selects any play and `init.leverDefs.length === 0`, show an unavoidable guided next action:
  - “Generate or activate levers before continuing.”
  - If drafts exist: activate draft.
  - If no drafts exist: synthesize levers.
- Disable moving to Step 3 as a “fake interactive” state unless the UI will either synthesize/activate or show a clear progress state.

### 3. Fix Step 3 to always show real sliders when data exists
- After committing a draft, refetch `engine-init` and initialize `levers` from the newly returned `leverDefs`.
- Ensure the Step 3 lever list uses `LeverRowV2` immediately after refresh.
- Keep “Show all N levers,” reset, lock, per-lever impact meter, and live GDP impact chips visible.

### 4. Make Step 4 impossible to reach with no real levers unless labeled as baseline-only
- If no committed levers exist, Step 4 should not pretend there are movers.
- It should show a clear “Activate AI levers to fine-tune this scenario” action.
- Once levers are committed and dragged, Step 4 sensitivity mini-sliders should appear from the top three attribution movers.

### 5. Harden the blank-screen route failure
- Add a route-level `errorComponent` for the new scenario route.
- Add a lightweight fallback around the guided rail/canvas so a failed data call shows a recoverable message instead of a solid white screen.
- Keep the retry action tied to router/query invalidation.

### 6. Validate with the actual ATG workflow
- Open `/admin/countries/ATG/scenarios/new?ministry=foreign-affairs-trade-barbuda-affairs`.
- Confirm the page renders text and controls, not a blank body.
- Activate the existing ATG lever draft.
- Confirm `Show all 12 levers` and visible slider rows appear.
- Drag one slider and confirm:
  - GDP fan chart changes.
  - Stat strip delta changes.
  - attribution stack / sector movement updates.
  - Step 4 top-mover mini-sliders become available.

## Technical scope

Files to change:
- `src/lib/scenarios/synthesize-levers.functions.ts` — add draft listing / activation helper or extend current commit flow.
- `src/components/scenarios/LeverDraftReview.tsx` — support existing drafts, not only new generation.
- `src/components/scenarios/GuidedRail.tsx` — replace the passive zero-lever message with activate/generate/retry states.
- `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx` — refresh and reseed levers after commit; add route error boundary.
- Possibly `src/components/scenarios/EmptyLevers.tsx` — make the empty state point to AI activation inside this chamber, not onboarding.

No schema change is needed.