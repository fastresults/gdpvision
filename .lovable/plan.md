# Deep Research fallback for the Country Ask flow

## Problem

When a user asks a question in `/console/:code/ask` (e.g. "What's driving inflation this quarter?") and the Second Brain has no matching corpus items, `askCounsel` returns an honest but dead-end answer: "evidence is missing." There is no way for the user to escalate that question to open-web deep research and get an actual, grounded answer.

## Goal

After any answer that Counsel judges "insufficient evidence", show a clear in-line prompt:

> The Second Brain doesn't have enough on this yet. Would you like me to run open-web deep research and combine it with what we do know?

One tap runs a **Deep Research** pass, writes the findings back into the corpus (so the next question benefits), and returns a fresh answer that blends corpus + deep-research citations.

## Backend

### 1. Insufficiency signal on `CounselAnswer`

In `src/lib/counsel.functions.ts`:

- Add `evidence_state: "sufficient" | "insufficient"` and `evidence_reason?: string` to `CounselAnswer`.
- Compute `insufficient` when any of:
  - `scored.length < 2` (fewer than 2 corpus hits), OR
  - top corpus score < a small threshold (no keyword overlap), OR
  - the model's SPOKEN/WRITTEN output contains an "insufficient evidence" marker we ask it to emit.
- Update the system prompt to require a machine-readable header line:
  `EVIDENCE: sufficient` or `EVIDENCE: insufficient — <one-line reason>`
  parsed alongside SPOKEN/WRITTEN.
- Persist `evidence_state` on `counsel_answers` (new nullable column via migration + GRANTs; existing rows treated as `sufficient`).

### 2. New server fn: `askCounselDeepResearch`

Same input as `askCounsel` plus `parentAnswerId?: string`. Behavior:

1. Rate-limit + budget check (separate, tighter caps than askCounsel — deep research is expensive; read from `instance_config.counsel.deep_limits`, defaults perUser/hour=6, perScope/day=40).
2. Force `corpusRead` down the external waterfall via a `forceExternal: true` flag (extend `corpusRead` to accept it, or call `searchMemory` directly and always `upsertMemoryObjects`). This runs the existing Perplexity → Gemini repair → inference pipeline scoped to the country + optional sector, with the user's question as the search brief.
3. Re-read `memory_objects` after write-back so the composed answer cites the newly ingested rows.
4. Regenerate the answer with a system prompt that (a) labels citations by origin — `[C#]` corpus vs `[R#]` fresh research — and (b) states clearly that this response used open-web deep research on `<date>`.
5. Return a `CounselAnswer` with `evidence_state: "sufficient"` (or `"insufficient"` again if the waterfall found nothing usable), `research_sources: Array<{url, title, publisher}>`, and `parent_answer_id`.
6. Persist to `counsel_answers` with `tags` including `deep_research` and a link column `parent_answer_id` (nullable FK, new migration).

### 3. Corpus gateway tweak

Add an optional `forceExternal?: boolean` to `corpusRead` that skips the "isEmpty" check and always calls `search` + `writeBack`. Keeps the existing waterfall + write-back semantics — no new research code path.

## Frontend

### 4. `AskTurn` shape

In `src/hooks/useCountryAskThread.ts` extend `AskTurn`:

```ts
evidenceState?: "sufficient" | "insufficient";
evidenceReason?: string;
deepResearch?: {
  status: "idle" | "running" | "done" | "error";
  sources?: Array<{ url: string; title: string; publisher?: string }>;
  spoken?: string;
  written?: string;
  citations?: CounselCitation[];
  ranAt?: string;
  error?: string;
};
```

Add an `update(id, patch)` helper alongside `append` / `remove` / `clear`.

### 5. Ask route UI (`src/routes/_authenticated/console.$code.ask.tsx`)

For any turn where `evidenceState === "insufficient"` **and** `deepResearch?.status !== "done"`:

- Render an **Insufficient Evidence Panel** immediately under the spoken block, styled as a warm advisory card (using the design tokens; no ad-hoc colors — `bg-paper-50`, `border-line-200`, `text-ink-800`):
  - Headline: "The Second Brain doesn't have enough on this yet."
  - One-line reason from `evidenceReason` when present.
  - Primary CTA `btn-primary`: **"Run deep research"** (48px tap target, sparkle icon, spinner + "Researching the open web…" while running — expect 15–40s).
  - Secondary `btn-ghost`: **"Skip — keep this answer"** (dismisses the panel by setting `deepResearch.status = "done"` with no results).
  - Small helper text: "Uses open-web sources, writes findings back to your Second Brain, then re-answers."

While running:
- Disable the CTA, show a shimmer line ("Scanning ministries, statistics offices, IMF/WB, reputable press…").
- Long-poll safe: request runs via `useServerFn(askCounselDeepResearch)`; on error, show inline retry with the provider message (`Counsel rate limit`, `credits exhausted`, `Perplexity timeout`, etc.).

On success:
- Replace the original spoken/written blocks with the new deep-research answer **in-place**, and mark the turn with a small "Deep research · <relative time>" pill under the question.
- Show a "Sources" accordion listing the fresh research URLs (title · publisher · link) plus the original corpus citations, clearly grouped as **Second Brain** vs **Open-web research**.

### 6. Empty state polish

Under the FAB empty state, add one-liner: "If we don't have it, tap Deep Research on any answer and I'll go find it." No new components.

## Rate limits, telemetry, safety

- Reuse existing `counsel_answers` rate-limit machinery; new tighter caps in `instance_config` key `counsel.deep_limits`.
- Every deep-research run emits `tags: ["deep_research"]` in `counsel_answers` for audit.
- All new writes to `memory_objects` inherit `visibility = 'public'` (public corpus contract) via the existing `upsertMemoryObjects` writers.
- No client-side secrets, no new connectors — reuses the corpus gateway + existing Perplexity/Gemini path.

## Migration

```
alter table public.counsel_answers
  add column if not exists evidence_state text,
  add column if not exists parent_answer_id uuid references public.counsel_answers(id) on delete set null;
```
Keep GRANTs unchanged (table already granted). No RLS changes.

## Out of scope

- Voice-triggered deep research (uses same CTA).
- Cross-country deep research (still scoped by `scopeKey`).
- Changing the general `/counsel/*` routes — only the Country Console Ask flow gets the CTA in this pass; the same server fn is reusable when we wire the older counsel routes later.

## Acceptance

1. Ask "What's driving inflation this quarter?" on a country with no inflation corpus rows → answer renders + Insufficient Evidence panel appears.
2. Tap **Run deep research** → spinner ≤ 40s → answer is replaced, sources accordion shows fresh URLs.
3. Ask the same question again → Second Brain now has rows, so no panel is shown; citations reference the newly ingested items.
4. Rate limit exceeded → clear inline error, no double-charged run.
5. `evidence_state` visible in `counsel_answers` for both original and deep-research rows; `parent_answer_id` links them.
