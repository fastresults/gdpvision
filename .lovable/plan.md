## Confirmed problem

The Brief route and renderer exist, but the navigation is still internally contradictory:

- `FieldStepper` points Brief to `/personas/field/brief`.
- `StageFrame.goStage()` still special-cases `brief` and sends it to the Chamber 07 index instead.
- That index explicitly redirects any committed field project to `/personas/field/plan`.
- Therefore Back/Amend navigation to Brief lands on Programme, reproducing the behavior shown.
- Other field entry links also default directly to `plan`, preserving the old assumption that Brief lives outside the rail.

## Fix plan

1. **Make the rail route canonical for Brief**
   - Remove the `brief → chamber index` exception from `StageFrame`.
   - Route Brief, Programme, Participants, Instruments, Fieldwork, and Evidence through the same `/personas/field/$step` path with the current project ID.
   - Ensure Back, Amend, rail clicks, and end-of-flow navigation all use this single stage-routing function.

2. **Remove the obsolete “Brief lives at the chamber door” behavior**
   - Update the field-stage registry and stale comments/constants so Brief is formally treated as a field work stage.
   - Stop the Chamber 07 index from being an amendment surface for an already-created field project.
   - Keep initial intake behavior only for projects that truly have no committed brief.

3. **Correct every field-programme entry point**
   - Change the sidebar Field Programme link and field track entry to open the correct resumable stage, with Brief always directly addressable.
   - Preserve the project query parameter on every transition.
   - Ensure a committed brief remains editable when revisited rather than redirecting forward automatically.

4. **Verify the exact reported journey**
   - Open the Grenada project on Programme.
   - Click the Brief rail tab and confirm the URL becomes `/personas/field/brief?project=…` and the Brief intake/amendment UI renders.
   - Use Back and Amend from later stages and confirm both return to the same Brief UI.
   - Click Programme afterward and confirm forward rail navigation still works without losing the selected project.