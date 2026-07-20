
## Problem

After a successful Chamber 07 auto-run, two things are wrong:

1. **The finished work product is invisible on the surface the user lands on.** Stage 03 renders synthesized studies as tiny 1-line tiles (title · kind · status · date). The actual output — `summary_md`, `themes`, quotes, citations from `study_reports` — is one click away *per study*, and there's no way to see "what did we learn" without opening 11 detail pages. The auto-run beacon says "10 completed" but the page shows nothing that looks completed.

2. **"Unexpected end of JSON input" on 1/11 studies.** This is not a synthesis bug — the report writer already `try/catch`es and swallows parse failures (`study.functions.ts:308`). The message bubbles from the *outer* `runStudy` server-fn call: when a single long `runStudy` invocation exceeds the worker request budget, the client receives a truncated/empty body and `useServerFn`'s response deserializer throws `Unexpected end of JSON input`. `study-autorun.ts:70-73` re-throws that message verbatim into the beacon.

Both are shipped in the same plan because they have the same root cause pattern: the pipeline optimizes for "did it run" instead of "can the user see the result".

## Plan

### 1. Make finished work product first-class on Stage 03

New component `src/components/personas/StudyWizard/SynthesisDigest.tsx` — a McKinsey-style digest that renders **inline on the studies list**, not just on the detail page.

- New server fn `listStudiesWithReports(countryCode)` in `src/lib/personas/study.functions.ts`: joins `studies` + `study_reports` + top themes + a persona count. Returns everything needed to render summaries inline (no per-study fetch).
- Replace the "Synthesized" `StudyGroup` in `countries.$code.personas.studies.tsx` with a `<SynthesizedDigestList>` that renders per study:
  - Title + method + persona count + duration
  - First ~180 words of `summary_md` via `<CitedMarkdown>` (existing component, already handles `[N]` refs)
  - Top 3 themes as chips with prevalence bars
  - "Open full brief →" link to detail
- Add a header **"What we learned"** section above the composer when ≥1 study is synthesized, showing count + a "Read all briefs" CTA that scrolls to the digest.
- Keep the compact tile view for `Running` and `Drafts` only.

### 2. Fix the JSON parse crash at the source

Two changes, minimal blast radius:

**a. Break `runStudy` into per-phase server fns** (`src/lib/personas/study.functions.ts`)

Split the current monolith into three idempotent server fns called sequentially from the client, so each fits inside a single worker request window:
- `runStudyResponses({studyId})` — persona/focus-group generation only
- `runStudySynthesis({studyId})` — reads persisted responses, writes `study_reports`, sets status
- Keep existing `runStudy` as a thin wrapper that calls both, for back-compat

Update `study-autorun.ts:completeStudyEndToEnd` to call them in sequence and treat each phase as independently retryable.

**b. Harden the AI Gateway response reader** (`src/lib/personas/study.functions.ts:40`)

Replace `await res.json()` with a text-first read that returns `""` on empty body instead of throwing:
```ts
const text = await res.text();
if (!text) return "";
const j = JSON.parse(text) as ...;
```
This eliminates the "Unexpected end of JSON input" class of failure across every AI call in this file.

**c. Auto-retry on transient parse/timeout errors** in `study-autorun.ts`

In `completeStudyEndToEnd`, when a phase fails with a message matching `Unexpected end of JSON input`, `Failed to fetch`, or `504`, retry that phase once after a 5s backoff before recording failure. Existing "needs review" surfacing in the beacon stays for hard failures.

### 3. Beacon copy fix

When a run finishes with N synthesized + M "need review", change the beacon Open link to deep-link directly to the digest anchor (`/admin/countries/$code/personas/studies#synthesized`) so the user immediately sees the work.

## Files touched

- `src/lib/personas/study.functions.ts` — safe response reader, split `runStudy` into `runStudyResponses` + `runStudySynthesis`, add `listStudiesWithReports`
- `src/lib/personas/study-autorun.ts` — call split phases, retry-once on transient errors
- `src/components/personas/StudyWizard/SynthesisDigest.tsx` (new) — inline digest card
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — render digest inline, "What we learned" header, anchor id
- `src/components/autorun/AutoRunBeacon.tsx` — no code change; the existing `href` already points at Stage 03, we'll just append `#synthesized` from the publisher in studies.tsx

## Out of scope

- Server-side parallelism for study execution (previously discussed — user chose UI recovery instead)
- Changing the synthesis prompt / adding more themes
- Any change to Stages 01/02

## Verification

- Trigger auto-run on a fresh country → land on Stage 03 → the digest shows `summary_md` + themes for each synthesized study without any per-study click.
- Simulate a worker timeout (throw inside `runStudySynthesis`) → auto-run retries once, then either recovers or reports the one failure while the other 10 remain visible with their briefs.
- Grep confirms no other `await res.json()` on AI Gateway responses in the personas module.
