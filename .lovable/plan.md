## Goal

Level up the Country Console into a genuinely AI-first, plain-language surface for ministers. Three moves:

1. Rename every internal "chamber" into a plain-language **Request type** the minister actually recognises.
2. Track and surface **time-in-flight** (days + hours) from submission to delivery, on every request and on the dashboard.
3. Turn the Study page into a real **dashboard** with attention, in-flight, and delivered lanes — organised by ministry and by request type, in the minister's words.

Nothing on the agency side changes semantically; the seven internal disciplines still exist behind the scenes.

## 1. Plain-language request types (the "seven features")

Rewrite `src/lib/concierge/minister-lexicon.ts` so each internal chamber maps to a single, obvious minister-facing label. This label is the ONLY thing the minister ever sees.

| Internal (agency) | Minister-facing label | One-liner |
| --- | --- | --- |
| ledger | **Economic brief** | "Where the economy stands right now." |
| scenario | **Decision brief** | "Model a decision I'm weighing and recommend." |
| fdi | **Sector deep-dive** | "A full look at one sector." |
| narrative | **Press & strategic comms** | "Draft a statement, remarks, or op-ed." |
| cabinet | **Cabinet paper** | "A short paper for the next cabinet session." |
| persona | **Research study** | "Study what people think about an issue." |
| portfolio | **Programme review** | "Review or coordinate across ministries." |

Also add: `Something else` (free-form → agency triages to the right internal team).

Wire this into:
- Wizard Step 2 (`console.$code.request.new.tsx`) — the picker becomes 7 clearly-labelled cards + "Something else", each with one example.
- Dashboard lane headers, request-list chips, and request-reader subtitle.
- `MINISTER_VOICE_SYSTEM` and `BANNED_TERMS` — extend banned list with "lane", "internal team names", and any older chamber terminology.

## 2. Time-in-flight tracking (days + hours, always visible)

Data already exists: `service_requests.submitted_at`, `delivered_at`, `accepted_at`. No schema change needed.

Add a shared util `src/lib/concierge/elapsed.ts`:
- `elapsedLabel(from, to?)` → returns `"2d 4h"`, `"6h 12m"`, or `"just now"`.
- `elapsedTone(status, from)` → `fresh | steady | overdue` based on days elapsed and status (overdue after 3 working days without delivery).
- `turnaroundLabel(submitted, delivered)` → for closed requests: `"delivered in 1d 8h"`.

Surface it in:
- **Request list row**: a right-aligned time chip. In-flight → `"In flight · 1d 6h"`. Delivered → `"Delivered in 2d 3h"`. Closed → `"Closed · 4d ago"`.
- **Request reader header**: a small timeline strip `Sent Mon 9:12 → With our team 2h later → Ready in 1d 8h`.
- **Dashboard**: each lane shows an "average turnaround" pill computed from the last 10 delivered requests.

Overdue tone uses `--signal-caution`; delivered uses `--signal-positive`. No new colour tokens.

## 3. The Study — a real minister dashboard

Rework `console.$code.index.tsx` into three attention layers, top to bottom:

**A. Attention band (top, sticky at scroll)**
- "Ready for you" count → jumps to filtered list.
- "In flight" count with oldest age (e.g. `3 in flight · oldest 2d 6h`).
- "Overdue" count if any (only shown when >0, in caution tone).

**B. In-flight lanes (middle)**
- Grouped by **request type** (the 7 plain-language labels), not chamber IDs.
- Each lane: header with type name, one-liner, average turnaround pill, and the requests in that lane as compact cards showing title, ministry, elapsed chip, current minister-facing status.
- Empty lanes collapse into a single "Start an economic brief / decision brief / …" row of prompts.

**C. Delivered library (bottom)**
- Last 20 delivered/accepted items, grouped by ministry (matches how ministers actually recall past work). Each row shows turnaround label so ministers see we're fast.

Hero action ("Start a request") stays; add a second secondary action "See everything in flight" that deep-links to the requests list pre-filtered to in-flight.

## 4. AI-first refinements in the wizard

Small but meaningful:
- Step 1 stays free-text. After the minister types, an AI classify call (already present in `concierge-ai.functions.ts`) returns a suggested **plain-language request type + one-line rewrite of the ask**. The wizard pre-selects that type in Step 2 with a "We think this is a … · change" affordance — never forces it.
- Step 3 "what form" defaults to the shape implied by the type but stays user-editable.
- Step 4 "when" now shows an expected-response estimate in plain language ("Our team usually returns an economic brief in 1–2 working days") pulled from the lane's rolling average, or a sensible default per type when we have no history.
- Confirmation screen restates the whole request in the minister's own words + expected return window in days & hours.

## 5. Agency-side (internal) — kept out of the minister's view

No visible change for the minister, but on the agency console:
- Show both the plain-language label AND the internal discipline (e.g. `Decision brief · scenario`), so agency staff still route correctly.
- Add elapsed + overdue badges to the agency queue too, using the same util.
- All agency-authored fields destined for the minister keep running through `enforceMinisterLexicon` — extend the scrubber for any new banned terms introduced here.

## Files touched

- `src/lib/concierge/minister-lexicon.ts` — new labels, banned-term additions, examples per type.
- `src/lib/concierge/elapsed.ts` — NEW time util.
- `src/routes/_authenticated/console.$code.index.tsx` — Attention band + type-grouped lanes + delivered library.
- `src/routes/_authenticated/console.$code.request.new.tsx` — new type cards, AI pre-selection, expected-return copy.
- `src/routes/_authenticated/console.$code.requests.index.tsx` — elapsed chip on each row + in-flight filter.
- `src/routes/_authenticated/console.$code.requests.$id.tsx` — timeline strip.
- `src/lib/console/console.functions.ts` — return average-turnaround per type + attention counters.
- Agency console pages — add elapsed badge (read-only surface change).

## Guardrails carried through

- Ministers still never see chamber names or internal system vocabulary.
- All time values are computed on the server and returned as ISO strings; formatting happens once in `elapsed.ts`.
- Uses the existing `btn-*` / `card-choice` utilities per the Button Contract — no new inline colour combos.
- No schema migration required; all fields already exist on `service_requests`.
