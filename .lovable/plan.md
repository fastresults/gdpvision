## What the audit found

For the Grenada programme you're on (`Strategic Positioning and Public Mandate Assessment for Investment Migration`):

- The recruitment frame **is** derived — 5 personas are saved on the project.
- `research_contacts` for that programme: **0 rows**, of which **0** from `ai_research`.

So the frame half of the AI-first contract works; the *find me real names* half never lands a row. Reading `recruitment-research.server.ts` + `recruitment.functions.ts`, three failure modes explain it, and none of them is visible to the user:

1. **The pass is too long for one request.** `researchPersonaCandidates` runs up to two sequential `sonar-reasoning-pro` calls, each with a 240s client timeout, inside one server function invoked from the browser. The edge runtime kills the request long before that — the same 502/timeout class we already fixed in the minister loop by going granular + `sonar-pro`.
2. **No run record, no logs.** Nothing is persisted before the model returns, so a killed request leaves zero trace. The board just goes quiet.
3. **The cleaner can silently zero the slate.** Every candidate must have an `https://` URL, a two-word name, and survive the generic-name filter. If the reasoning model wraps its JSON in `<think>` prose, `parseSonarJson` returns null and the whole persona yields nothing — reported only as a soft note the UI may not surface.

Also missing: no way to research *all* personas at once, no persona-level status ("searched / thin / none"), and the corpus only receives the frame on a successful pass, so failed hunts leave no learning.

## The plan

### 1. A real recruiter agent loop (server)
Rewrite `researchPersonaCandidates` into a bounded, resumable agent with **short passes instead of one long one**:

- **Pass A — locate the registries.** `sonar-pro`, cheap and fast: given the persona and `where_to_look`, return 3–8 concrete URLs where such people are publicly named (ministry leadership pages, association boards, registries, chamber directories).
- **Pass B — extract names.** For each registry URL batch (2–3 URLs per call), a `sonar-pro` call that returns named individuals with role, organisation and the URL that names them. Small calls, each well inside the request budget.
- **Pass C — widen only if thin.** One adjacent-institution sweep when Pass B yields fewer than the target.
- Each pass writes its candidates to `research_contacts` **as it completes** — so a killed request still leaves what it found.
- Drop `sonar-reasoning-pro` here; strip `<think>` blocks defensively in the parser regardless.

### 2. Durable run tracking
New table `research_recruitment_runs` (project, persona, status, pass, found, proposed, notes, sources, timestamps; RLS + GRANTs in the same migration). The server fn opens a run, updates it per pass, closes it `complete` / `thin` / `failed` with the real error text.

### 3. Browser-driven loop (same pattern as onboarding "run all pending")
`researchCandidates` becomes one *pass* per call. The board drives it:
- **"Find candidates" per persona** → loops passes until the run closes.
- **"Research every persona"** → walks the frame persona by persona with a live progress rail (persona · pass · found so far).
- Progress and errors render inline on each persona card, never a silent spinner.

### 4. The board tells the truth
`RecruitmentBoard.tsx` gains per-persona state: `not searched` / `searching · pass 2 of 3` / `12 sourced` / `thin — 3 of 20` / `failed — <reason>`, with the sources list expandable and a **Retry** and **Add by hand** always available. Accept-all and per-person accept stay as they are.

### 5. Corpus filing on every outcome
File the recruitment frame plus each run's outcome (persona, registries found, sourcing yield, notes) to the second brain via `upsertMemoryObject` — including failures, so a later programme in the same country starts from the registries we already located. Identity still never leaves the CRM; only the frame and the source URLs are filed.

### Technical notes
- Files: `src/lib/personas/recruitment-research.server.ts` (agent rewrite), `src/lib/personas/recruitment.functions.ts` (per-pass fn + run bookkeeping), `src/components/personas/field/RecruitmentBoard.tsx` (progress + status), one migration for the runs table.
- `parseSonarJson` hardened to strip `<think>…</think>` and fenced blocks before parsing.
- Every pass logs `console.info` with project, persona, pass, count — so `server-function-logs` shows the hunt next time.
