
## Goal

Turn Ask-the-Ledger into a mobile-first, robust Q&A surface with voice input, copy/clear controls — and rewrite the answer engine so responses read like a disciplined McKinsey brief: precise, on-question, evidence-first, no drift.

---

## Part A — UX/UI upgrades (`src/components/ledger/AskTheLedger.tsx`)

### 1. Mobile-first layout
- Replace fixed side-rail (`w-96`, `h-[70vh]`, right-anchored) with responsive shell:
  - **Mobile (`<md`)**: full-screen sheet triggered by a floating pill button anchored bottom-right; sheet slides up from bottom, uses `100dvh`, safe-area padding (`env(safe-area-inset-bottom)`), sticky header + composer.
  - **Desktop (`≥md`)**: keep existing right-rail behavior.
- Larger tap targets (min 44px), bigger text (`text-base` on mobile, `text-sm` on desktop), composer buttons become icon-first.

### 2. Composer controls (new toolbar row above textarea)
- **Mic button** — press-to-record voice input using `MediaRecorder` (audio/webm or mp4 on Safari) → POST to a new `transcribeQuestion` server function that proxies Lovable AI `/v1/audio/transcriptions` with `openai/gpt-4o-mini-transcribe` (per `ai-speech-to-text` knowledge). Live level indicator; auto-fills the textarea with the transcript (user can edit before Ask). Guard: reject blobs <2 KB, show inline error, request mic permission with clear rationale.
- **Send** button — arrow icon, disabled while pending or recording.
- **Clear conversation** — trash icon in header; confirms then empties `turns` and aborts any in-flight mutation.
- **Stop / cancel** during recording and during answer streaming.

### 3. Per-answer actions (in `TurnBlock`)
- **Copy answer** — copies plain text (strips `[N]` markers optional; keep by default) via `navigator.clipboard.writeText`; toast "Copied".
- **Copy with citations** — appends numbered source list.
- **Regenerate** — re-runs the same question.
- **Pin to snapshots** (existing) — keep.
- Actions collapse into an overflow menu on mobile, inline icons on desktop.

### 4. Empty-state + suggestions
- Show 4 tappable example prompts scoped to the current country/sector to reduce cold-start drift ("What is the largest export sector?", "Summarize fiscal position", etc.).

### 5. Accessibility
- Every icon button has `aria-label`; recording state announced via `aria-live`; focus returns to composer after send.

---

## Part B — Answer quality: "McKinsey steward" rewrite (`src/lib/ledger.functions.ts` → `askTheLedger`)

Symptom: answers drift, add unsolicited recommendations, and don't stay tight to the question. Root causes: (a) weak retrieval — single ILIKE OR over 40 chunks with no re-ranking; (b) permissive system prompt that doesn't forbid recommendations or off-question content; (c) small flash model with no structured output contract.

### 1. Retrieval upgrades
- Expand candidate pool to top 60 chunks, then **re-rank** by token overlap + recency + source-weight (existing `country_sources.weight` if present); keep top 8.
- Always include the country's headline KPIs (`country_kpis`) and, if `sectorCode` provided, the matching `sector_dossiers` row as high-priority citations so answers can anchor on canonical numbers.
- Deduplicate excerpts by `source_id` (max 2 chunks per source) to prevent one document dominating context.

### 2. Structured, disciplined prompt
Replace current one-paragraph brief with a strict "steward" contract that forces on-question focus and forbids drift:

```
ROLE: You are the National Ledger's steward. You answer like a McKinsey associate
partner — precise, quantitative, and disciplined.

RULES (violating any rule = failed answer):
1. Answer ONLY the exact question asked. Do not volunteer recommendations,
   opinions, next steps, or strategic advice unless the user explicitly asked.
2. Use ONLY facts present in CONTEXT. Every numeric, name, or date claim MUST
   carry a [N] citation matching a CONTEXT item.
3. If CONTEXT does not contain the answer, reply exactly:
   "The Second Brain has no grounded evidence for this question."
4. No hedging, no filler ("it is important to note…"), no restating the question.
5. Prefer numbers over adjectives. Round consistently.

FORMAT: Return JSON with { "direct_answer": string (≤60 words, the single
crisp answer), "key_evidence": string[] (2-4 bullets, each ≤25 words with [N]),
"confidence": "high"|"medium"|"low", "caveats": string[] (optional, only when
CONTEXT is thin — max 2). No other keys, no prose outside JSON.
```

Use AI SDK `Output.object` with a small unbounded schema (per `ai-sdk-agent-patterns` — no `.min/.max`, wrap in `NoObjectGeneratedError` fallback).

### 3. Model choice
- Upgrade from `google/gemini-3-flash-preview` to `google/gemini-3.5-flash` (current-gen, better instruction-following) for default. Keep model id centralized so we can swap.

### 4. Renderer
- Update `TurnBlock` to render the structured answer:
  - Bold "direct answer" line.
  - "Evidence" bulleted list with [N] links (existing renderer).
  - Small confidence chip (high/medium/low).
  - Caveats only shown when present.
- Backward-compatible: if server returns legacy `answer` string, render as before.

### 5. Refusal & guardrails
- If user question looks like a recommendation request ("what should…", "recommend…"), the prompt still forces evidence-only — but add a small helper note in UI: "Ask the Ledger reports evidence; use the Scenario Engine for recommendations." (link to Chamber 03).

---

## Part C — New server function

`transcribeAudio` in `src/lib/ledger.functions.ts` (or new `src/lib/voice.functions.ts`):
- `createServerFn({ method: "POST" })` with `requireSupabaseAuth`.
- Accepts base64 audio + mime; forwards multipart to Lovable AI STT endpoint with `openai/gpt-4o-mini-transcribe`, `language` auto, non-streaming (buffered result — this is single-shot dictation, not live).
- Returns `{ text: string }`. Rate-limit / 402 errors surfaced to UI toast.

---

## Technical details

- Files touched:
  - `src/components/ledger/AskTheLedger.tsx` — full UX rewrite, responsive.
  - `src/lib/ledger.functions.ts` — rewrite `askTheLedger` (retrieval + prompt + structured output + model), add `transcribeAudio`.
  - New tiny hook `src/hooks/useVoiceRecorder.ts` for MediaRecorder lifecycle + level meter.
  - Reuse existing `LedgerAnswer` type, extend with optional `structured?: { direct_answer, key_evidence, confidence, caveats }`.
- No DB migrations required. No new tables. RLS unaffected.
- Follows existing PrettyJson rule (not applicable here — answers are prose, not JSON payloads for display).
- Mobile sheet uses shadcn `Sheet` primitive already in project.

## Out of scope
- Streaming answers (keep non-streaming; structured output requires full response). Can add later.
- Persisting Ask history to DB (turns remain in-memory as today).
- Multi-turn conversation memory (each question retrieves independently — matches current behavior).
