# Stage 04 · Fieldwork — a guided field desk

## What is actually wrong

Three problems, and only one of them is cosmetic.

**1. The hosted collection leads nowhere.** Invitations mint a token and the comms templates mail out `"/f/<token>"`, but there is no such page in the app (`src/routes` has no `f.$token` route). Every invited participant would hit a 404. Nothing can ever be returned through the platform — which is why the stage feels inert.

**2. Nothing carries over from the earlier stages.** The plan already states the method mix, the audiences and the sample sizes (450 survey, 25 depth interviews, 10-person expert panel for the Grenada programme). Stage 02 already composed named focus-group slates into `research_panels`. Stage 03 already drafted the questionnaire and the guide. Stage 04 ignores all of it: it shows an empty "Session title" box and a blank date field, and "Invite the panel" grabs whichever panel happens to match first — survey slate or focus group, no distinction.

**3. There is no sense of where you are.** Two boxes side by side, no order, no target, no "what happens next", no fielding progress, no way to close the field. Completion is satisfied by a single response or one session marked held, regardless of the plan.

## The redesign: a fielding ladder, derived not typed

Stage 04 opens with a **derived fielding plan** — the same AI-first beat Stage 03 now has. From the approved method mix the chamber lays out the actual waves this programme must run, each as a card with its own state:

```text
WAVE 1 · Questionnaire · Citizens & Diaspora        target 450   ▓▓▓░░░░░  118 in
WAVE 2 · Depth interviews · Agents & developers     target  25   ▓▓░░░░░░    6 held
WAVE 3 · Expert panel · Regulators & policy         target  10   ░░░░░░░░  scheduled
```

Each wave states what it is for, who it goes to, the instrument it fields, its target, and the single next action. No wave is typed by hand — survey lines become a hosted collection, qualitative lines become sessions pre-seated from the slates composed in Stage 02.

### Wave A — the questionnaire
1. **Open the field** — creates the collection against the drafted questionnaire, states the target from the plan.
2. **Invite** — invites the *survey* slate only, and offers the three real routes in one place: send by email, copy each participant's link, or download the link list as CSV for a partner to send. Sending is one action from this stage, not a separate comms screen.
3. **Watch it come in** — invited / opened / returned counts against target, oldest outstanding invitation, and a one-click reminder to non-responders.
4. **Off-platform returns** — the paste box stays, but with a worked example and a file drop, and it reports what it parsed before it commits.

### Wave B/C — sessions
1. Sessions are **proposed from the composed slates** — one card per slate, named, with its seated participants already listed, so the admin schedules rather than invents. An ad-hoc session stays available.
2. Scheduling captures time, venue or join link, moderator, and the guide it runs against.
3. Attendance is ticked from the seated list (`setSessionAttendees` / `setAttendance` already exist and are simply not wired to any UI).
4. Held → **capture** — paste a transcript, or upload the recording and let the existing transcription path do the work; filed to the second brain with the session's provenance.

### Close the field
An explicit final action: close the collection, state what was gathered against what was planned, and hand it to Stage 05. That is what makes the stage *done* — not the accidental first response.

## The missing participant page

A public route `/f/$token` (under the public-API convention, no auth) that:
- resolves the invitation token, shows the instrument's intro and consent, renders the questions by type (choice, scale, ranking, matrix, open text), saves partial progress, and submits into `field_responses`;
- honours `?opt_out=1` by setting the contact's opt-out and never contacting them again;
- refuses closed or capped collections politely.

Without this page nothing else in Stage 04 can complete, so it is built first.

## Honest constraint: email delivery

No email provider key is configured for this workspace, so `sendToInvitees` currently queues rather than sends. The stage will say so plainly and lead with copy-link and CSV export, with a one-line prompt to add a provider when the principal wants the chamber to send on their behalf. I will not present queued mail as sent.

## Completion logic

`computeFieldProgress` stops treating "one response OR one session" as done. Instead, per wave: a survey wave is fielding when it has returns and complete at target (or when the admin closes it early with a stated reason); a session wave is complete when every planned session is held and captured. The stage is done when every wave the plan requires is closed. The blocker text names the wave and the one action that moves it.

---

## Technical detail

**New**
- `src/routes/f.$token.tsx` — public participant response page (+ a server route under `src/routes/api/public/` for token resolve/submit so it works unauthenticated).
- `src/lib/personas/fieldwork-plan.server.ts` — derives waves from `programme_plans.method_mix` (reusing the same method→instrument mapping as `instrument-draft.server.ts`), maps each wave to its collection or its composed `research_panels` slate, and computes progress against `sample_size`.
- `src/lib/personas/fieldwork.functions.ts` — `getFieldworkBoard` (one read: waves, collection, invitations, sessions, slates, targets), `openWave`, `inviteWave`, `sendWaveInvites`, `remindNonResponders`, `scheduleFromSlate`, `closeWave`.
- `src/components/personas/field/fieldwork/` — `WaveCard`, `CollectionWave`, `SessionWave`, `SessionCard`, `InviteDrawer`, `CaptureDrawer`.

**Changed**
- `src/components/personas/field/FieldworkStage.tsx` — becomes a thin composition of the wave cards; keeps the existing dirty-state registrations for transcript and pasted returns.
- `src/lib/personas/field-progress.server.ts` — wave-aware instruments/fieldwork completion and blocker text.
- `src/lib/personas/field-stages.ts` — `doneWhen`/`resolve` copy for the fieldwork stage.
- `src/lib/personas/field-collection.functions.ts` — invite by slate rather than by first matching panel; expose participant links; reminder pass.
- `src/lib/personas/field-sessions.functions.ts` — `scheduleFromSlate` seating attendees at creation.
- `src/lib/explain/personas-entries.ts` — rationales for wave derivation, target sizing, and what "closed" means.

**Unchanged**: no schema migration. `field_collections`, `research_invitations`, `field_responses`, `field_sessions` and `field_session_attendees` already carry every column this needs.

Maps regenerated with `bun run headers && bun run map` at the end.
