# The Concierge — an AI-first Request Wizard + Deliverables Dashboard

The layer keeps the data model from the previous plan (service_requests, deliverables, agency console, notifications, audit log, chamber-typed artifacts). What changes is the *surface* the minister touches. Instead of a form, they walk through a cinematic five-act wizard co-piloted by AI, and the finished work returns to a deliverables dashboard organised the way a minister thinks about their own portfolio.

## The two languages, kept strictly separate

The minister and the agency see two different vocabularies over the same spine.

```text
 Minister-facing vocabulary            Agency-facing vocabulary (internal)
 ──────────────────────────            ──────────────────────────────────
 "A request"                     ↔     service_request row
 "Ask about the economy"         ↔     Chamber 01 · National Ledger
 "Model a decision"              ↔     Chamber 03 · Scenario Engine
 "Sector deep-dive"              ↔     Chamber 04 · FDI Transition Studio
 "Public message / briefing"     ↔     Chamber 05 · Narrative Chamber
 "Cabinet briefing"              ↔     Chamber 06 · Cabinet Room
 "Population research"           ↔     Chamber 07 · Persona Lab
 "Portfolio work"                ↔     Chamber 02 · Portfolio Workspaces
 "A finished response"           ↔     Deliverable artifact
 "Reference / evidence"          ↔     Second Brain citation
```

**Non-negotiable rule for every minister-facing surface:** no chamber names, no chamber numbers, no "Ledger", "Scenario Engine", "Second Brain", "corpus", "artifact", "workspace", "pipeline", "grounding", "citation IDs", "SLA", "queue", "triage". The AI co-pilot, the wizard prompts, the emails, the confirmations, and the dashboard labels are all written in a Prime-Minister-facing register: short, direct, decision-oriented. The agency side is the only place the internal vocabulary appears.

We enforce this with a single shared file `src/lib/concierge/minister-lexicon.ts` that all minister-facing components and all AI prompts import — chamber IDs map to minister-facing labels, one-line descriptions, and example asks. Nothing on the requester side hard-codes a chamber name.

## The two surfaces, at a glance

```text
 Minister                                   Open Interactive
 ────────                                   ────────────────
 /concierge          ── request ──▶         /agency  (internal queue)
   ▲                                              │
   │                                              │ works inside
   │                                              ▼ the seven chambers
   └── response ◀── delivers ── document + evidence
```

Requester side = **The Concierge**. Agency side = the operational console from the previous plan. Both share the same data spine; only the requester surface is being elevated. The agency side still uses the internal terminology it needs to do its job.

---

## Act I — The Wizard (`/concierge/new`)

An AI-first, five-step, one-question-at-a-time flow. Full-bleed layout, one thought on screen, generous whitespace, editorial serif for prompts, tabular sans for structured input. Progress is a thin ribbon at the top, not a stepper. Every step has an AI companion pane on the right that reasons out loud as the minister types — in plain language, never naming the engine underneath.

### Step 1 · Speak the need
One prompt: *"What would you like our office to work on, Minister?"* Three equal-weight inputs — **type**, **paste**, or **hold-to-record** (reuses Persona Lab transcription). No selector, no categories, no jargon.

As soon as ~30 words exist, the AI companion streams a soft, minister-facing interpretation in the right pane. It **never** names the underlying system. Example:

> *"I hear a question about how a VAT change might affect jobs in tourism. It sounds like a decision you're weighing — I'll put this in front of a team that can model the trade-offs and give you a written brief."*

Not: "This looks like a Scenario Engine brief with Ledger grounding." That phrasing is banned on the requester side.

### Step 2 · Confirm what you're asking for
The AI picks the best-fit response shape and shows a single beautiful card describing it **in minister language**:

- Title: *"A decision brief with modelled scenarios"*
- One-line description: *"Our team will model the trade-offs of the change you're weighing and return a short written brief with the numbers and the recommendation."*
- Two or three example past deliverables of that shape (anonymised titles from the same country's history, e.g. *"Fuel subsidy phase-out — decision brief, 3 pages"*).

A quiet affordance — *"Ask for something different"* — opens a fan of the other minister-facing response shapes (see the lexicon table above), each described in plain language. The seven chambers are never numbered, named, or referenced.

### Step 3 · Sharpen the ask
The AI extracts a structured **request card** from Steps 1–2 and shows it as an editable, minister-facing document:

- **The question** (one sentence, minister's own words)
- **Why it matters** (the decision this informs)
- **What you'll get back** (a written brief · a modelled scenario · a sector deep-dive · a public statement · a cabinet briefing · population research)
- **What we'll build it on** (three short bullets in plain language: *"latest tourism revenue and employment data,"* *"your current fiscal position,"* *"IMF Article IV consultation notes"* — never *"Second Brain citations [3]"* or table names)
- **When you need it** (This week / Next week / Whenever fits)

Every field is AI-drafted, minister-editable. Small pencil icons let the minister edit each line. No `[N]` markers, no citation IDs, no jargon. The internal grounding *is* recorded in the same server call — it's just hidden from the requester surface and visible to the agency.

### Step 4 · Add anything else (optional)
Drag-and-drop for PDFs, DOCX, images, voice memos. The AI extracts each attachment and shows a plain-language bullet summary — *"Your handwritten note mentions concerns about the outer islands"* — so the minister sees the system read them. Files land in the private `service-requests` storage bucket.

### Step 5 · Send it
A single closing screen. Full request rendered as a printable-looking document — a signet at the top, the question, why it matters, what you'll get, what it will be built on, when you need it, attachments, submitter's name and title. One button: **Send this to our team**. On submit, a short cinematic transition (a wax-seal / signet-ring motif tied to the marketing site's SignatureRing) confirms receipt and states in plain language when to expect a response.

### Wizard mechanics
- One `RequestDraft` client state object flows through all five steps; every keystroke autosaves to `service_request_drafts` so refreshing never loses work.
- The AI companion uses `google/gemini-3.6-flash` for streaming interpretations, and `openai/gpt-5.4-mini` for the structured request extraction in Step 3.
- The prompts sent to those models include an explicit system rule: *"Never mention chambers, engines, ledgers, pipelines, artifacts, citations, or any internal system names. Speak the way a Prime Minister speaks."* — enforced by prompt + a post-generation lint that rejects any output containing banned terms and re-runs the call.
- Grounding is done server-side against the same country data as before (country_kpis, country_sectors, intake_items, ministry_profiles). The evidence is stored on the request row for the agency; only plain-language paraphrases surface to the minister.
- Keyboard-first: `Enter` advances, `⌘K` re-invokes the AI, `Esc` saves draft and exits.
- Zero visible chrome from `/home`; the wizard is its own theatre.

---

## Act II — The Concierge Dashboard (`/concierge`)

The minister's private study. Not a queue. Three horizontal bands, each with its own visual register. **All labels are minister-facing.**

### Band 1 · Responses — organised the way a minister thinks
A gallery of horizontal lanes, each lane labelled in minister language, each a horizontally-scrolling row of "response cards":

- **The economy** *(internally: Ledger)*
- **Decisions & scenarios** *(internally: Scenario Engine)*
- **Sectors** *(internally: FDI Transition Studio)*
- **Public messages** *(internally: Narrative Chamber)*
- **Cabinet & governance** *(internally: Cabinet Room)*
- **Population & audience research** *(internally: Persona Lab)*
- **Portfolio work** *(internally: Portfolio Workspaces)*

A card is the size of a Polaroid, softly tinted per lane, and shows: title, date delivered, agency lead's initials, a one-line pull-quote from the response, and a status ribbon (**Delivered · Read · Acted on**). Click → opens the response document in a distraction-free reader view; the internal artifact viewer stays hidden behind the reader. A quiet *"See the full working"* link opens the underlying chamber view for ministers who want the depth — but that link is not the default.

Empty lanes show a whisper: *"Nothing on public messages yet. Ask for one →"* which pre-fills a wizard.

### Band 2 · In flight
A shorter row of requests still moving through. Status labels are minister-facing, not internal:

- **Sent** *(internally: New)*
- **With our team** *(internally: Triaged / In Progress)*
- **Being finalised** *(internally: Review)*
- **Ready for you** *(internally: Ready)*

Each is a slim horizontal card with a progress thread (not a bar) that visibly *breathes* — a subtle animated ink stroke that lengthens as the agency updates the request. Each card shows the agency lead who owns it, an expected-response window in plain language (*"by Thursday"* rather than *"SLA 72h"*), and a one-line "what's happening now" written by the agency in minister-facing language (the response-memo composer forces the same lint).

### Band 3 · Ask the Concierge
A single elevated call-to-action bar, always visible at the bottom: a text field styled like a title page — *"What would you like to know, Minister?"* — that opens directly into the wizard's Step 1 with the text pre-filled.

### Peripheral surfaces
- Sticky top strip with soft response-count badges by lane (mirrors the marketing-site SignatureRing motif) — clicking a lane filters both bands to that lane. Lane labels are the minister-facing ones.
- Notification bell in the top nav badges unread state changes (in-app only, per your earlier choice). Notification copy is minister-facing (*"Your team has finished the tourism brief"* — never *"Deliverable ready in Scenario Engine"*).
- Every card is deep-linkable and reload-safe (`/concierge?lane=economy&request=…` — URL uses the minister-facing lane slugs, not chamber IDs).

---

## Act III — The response document (the artifact both sides share, worded twice)

The response is not just a database row; it renders as **a document** wherever it appears. The minister-facing view uses minister language; the agency-facing view uses internal language. The underlying data is one record.

- Minister sees a **reader view**: cover page, the original request in their own words, a short "how we approached this" note (plain language: *"we drew on your latest tourism and fiscal data and modelled three scenarios"* — never *"grounded in country_kpis with three lever configurations"*), findings, recommendations, sources described in plain sentences.
- Agency sees the same record with internal headers: original brief, methodology, chamber artifact IDs, cited memory-object IDs, `[N]` citation markers.
- Export to `.md` and `.pdf` — the minister export runs through the lexicon-scrubber; the agency export does not. Both follow the global report contract already in use in Chamber 07 (Frame, Original Brief, Methodology, Findings, Citations), but the minister export's *"Methodology"* section is a plain-language paragraph, not a technical breakdown.

---

## Data model additions (on top of previous plan)

- `service_request_drafts` — autosaved wizard state per (user, country). One draft per user in progress; overwritten on submit.
- `service_requests` — adds:
  - `minister_summary text` (plain-language summary shown to the requester)
  - `internal_chamber text` (the chamber the agency will use — never surfaced to the minister)
  - `chamber_confidence numeric`
  - `submitted_channel enum('typed','pasted','voice')`
- `service_request_events` — adds two columns:
  - `minister_summary text` (what the minister sees on the in-flight card)
  - `internal_note text` (what the agency writes internally)
  - Both are optional per event, so the agency can record internal-only steps without spamming the minister.
- `service_request_deliverables` — adds `minister_body_md text` and `internal_body_md text` — two renderings of the same response, one lexicon-scrubbed, one raw.

RLS and GRANTs follow the previous plan.

---

## AI orchestration (server-only)

Three server functions carry the wizard. All three enforce the minister-facing lexicon on any text that will surface to the requester.

- `interpretIntent(text)` — streams via `streamText`, returns a soft minister-facing interpretation + an internal-only chamber pick with confidence. System prompt hard-bans internal vocabulary in the interpretation stream.
- `draftRequestCard({ text, countryCode })` — one-shot `generateText` + `Output.object` producing the structured request card (question, why it matters, deliverable shape, "what we'll build it on" in plain language, timing). Output goes through `enforceMinisterLexicon()` — a small deterministic scrubber that flags banned terms and re-prompts up to twice before falling back to a safe default line.
- `submitRequest(draft)` — validates, persists both the minister-facing card and the internal chamber pick, seeds the request-events log, notifies the agency role.

The agency-side composer for response memos and status updates uses the same `enforceMinisterLexicon()` on any field marked "visible to minister", so ministers never receive a status ping that says *"artifact bound in Scenario Engine"*.

All three are `requireSupabaseAuth`, country-scoped, and log tokens/latency to a lightweight `ai_gateway_events` row so we can observe cost.

---

## Rollout, in order

1. **Lexicon module** — `src/lib/concierge/minister-lexicon.ts` (chamber → minister label, banned-terms list, `enforceMinisterLexicon()`). This is the foundation the rest imports.
2. **DB migrations** — everything from the previous plan + `service_request_drafts` and the split minister/internal columns above.
3. **Server layer** — `service-requests.functions.ts` (submit / list / detail / accept / revise / deliverable-attach) and `concierge-ai.functions.ts` (interpret / draft) — all writing both minister and internal fields.
4. **Wizard shell** — `/concierge/new` five-step engine with autosave, keyboard nav, and the AI companion pane. Feature-flag it so we can build without shipping until it's beautiful.
5. **Dashboard** — `/concierge` with the three bands, minister-facing lanes, breathing in-flight cards, and Ask bar.
6. **Agency Console** — the internal queue, request detail with country context strip, chamber-typed deliverable picker, response-memo composer (with minister-facing preview + lexicon lint), expected-response clock (from previous plan).
7. **Deep-link binding** — each chamber accepts `?request=<id>`; finished artifacts inside a chamber auto-suggest binding to that request. The binding writes both a minister-facing and an internal note.
8. **Notifications + audit** — bell, badges, event log rendered on both sides in their respective vocabularies.
9. **Design pass** — before rollout, run the redesign ritual: capture the built wizard step and the dashboard, ask the user to pin palette / type / layout, generate three rendered directions, ship the pick verbatim. Motion, wax-seal signet, breathing progress threads all decided there — no guessing beforehand.

## Non-goals for this pass

- No email/SMS; in-app bell only (per your earlier answer).
- No self-service AI resolution — the agency human is always the responder. AI drafts the *request*, not the *response*.
- No billing/quotas.
- No cross-agency multi-tenant.

## Why the language separation matters

- The minister never has to translate their own words into the platform's vocabulary. They speak; the platform absorbs.
- Open Interactive keeps every internal signal it needs — chamber routing, citations, confidence, artifact binding — without leaking any of it into the requester surface.
- The lexicon module is one file. If we ever add an eighth chamber or rename a system, the requester surface doesn't change; only the mapping does.
- Every response the minister reads sounds like it came from a chief of staff, not from a piece of software.
