
## Goal

Add an **Opposition Intel** surface to Chamber 05 (Narrative Chamber) where a country's comms department can drop opposition memes, screenshots, links or forwarded stories. The system then runs AI analysis to summarize (a) the underlying **motivation / message**, (b) the likely **origin & amplification pattern**, and (c) a recommended **counter-campaign response** — all grounded in the country's Second Brain and stored as first-class narrative artefacts.

The feature must slot elegantly into the already-dense Narrative Chamber sidebar without adding visual noise.

## UX integration (keep sidebar calm)

Chamber 05's left rail today holds: hero copy → Comms Library → Add Signal → Active Signals list → back link. Rather than adding a fourth button, introduce a **compact segmented control** directly under the "Signal to statement." hero:

```text
[ Signals ] [ Opposition ]
```

- Default = Signals (current behaviour, no change).
- Selecting **Opposition** swaps the rail body: Add Signal + Active Signals list are replaced by an **Opposition tray** (drop-zone + threat list). Comms Library link stays visible in both modes — it's cross-cutting.
- The right-hand `<Outlet />` routes as normal. Opposition items open in the same detail column via a new route.

This preserves single-column density on mobile and keeps the sidebar footprint identical.

## Routes

- `/_authenticated/admin/countries/$code/narrative/opposition` — index (drop-zone + list).
- `/_authenticated/admin/countries/$code/narrative/opposition/$id` — detail (analysis + response plan).

Both nested under the existing `narrative` layout so the rail persists.

## Drop-zone intake

Single component `OppositionIntakeDropZone`:
- Accepts: images (jpg/png/webp/gif), pdfs, plain text pastes, and URLs. Multi-file, drag-and-drop + click-to-upload + paste-from-clipboard.
- Files upload to a new **private** storage bucket `opposition-intel` (path `${country_code}/${uuid}/…`).
- URLs and pasted text create text-only items (no upload).
- Each drop creates one `opposition_items` row per file/url with `status='queued'` and immediately kicks off analysis via `analyzeOppositionItem` server fn.

## Data model (one migration)

New public tables, same GRANT + RLS shape as `narrative_feeds` / `comms_artifacts`:

- `opposition_items`
  - `id uuid pk`, `country_code text`, `kind text` (`meme` | `story` | `post` | `screenshot` | `link` | `text`), `title text`, `source_url text`, `storage_path text` (nullable), `mime_type text`, `raw_text text`, `submitted_by uuid`, `submitted_channel text` (freeform: "WhatsApp", "X", "TikTok"…), `status text` (`queued` | `analyzing` | `analyzed` | `failed`), `motivation_summary text`, `origin_summary text`, `amplification jsonb` (platforms, reach hints, first-seen), `themes jsonb`, `severity int`, `sentiment int`, `confidence_grade char(1)`, `citations jsonb`, `visibility text default 'private'`, `owner_country_code text`, `uploaded_by uuid`, timestamps.
  - Unique `(country_code, coalesce(storage_path, source_url, md5(raw_text)))` to dedupe re-drops.
- `opposition_response_plans`
  - `id uuid pk`, `item_id uuid fk`, `country_code text`, `posture text` (`ignore` | `clarify` | `counter` | `escalate`), `objective text`, `key_messages jsonb`, `audience_segments jsonb`, `channel_plan jsonb` (array of `{channel, cadence, artifact_kind}`), `sequenced_actions jsonb` (Day 0 / +1 / +3 / +7), `risks jsonb`, `success_metrics jsonb`, `linked_artifact_ids uuid[]`, `citations jsonb`, `confidence_grade char(1)`, timestamps.
  - Unique `(item_id)` — one canonical plan per item; regenerate replaces via `on conflict update`.

Standard `enforce_private_ownership` trigger reused. RLS: admins full access; country members read/write where `has_country_access(auth.uid(), country_code)` — opposition intel is always country-private, never global.

New storage bucket `opposition-intel` (private).

## Analysis pipeline (server-only)

`src/lib/narrative/opposition-analysis.server.ts` — mirrors the shape of existing narrative research.

Per item, three passes, gated by evidence:

1. **Extract pass** — if image, run OCR via Lovable AI multimodal chat (Gemini image-in) to pull embedded text + describe visuals; if pdf, extract text; if url, `fetchCitationText`; if raw text, pass through. Produces `raw_text`.
2. **Motivation pass** — Lovable AI (`sonar-reasoning-pro` via gateway) analyses raw_text + Second Brain context (`country_chunks_search` on top themes) to produce `{motivation_summary, themes[], sentiment, severity, confidence_grade, citations}`.
3. **Origin pass** — separate Perplexity call with domain hints (opposition party sites from `country_parties`, known regional aggregators, X/TikTok/FB search) to fill `origin_summary` and `amplification` (`{first_seen_platform, likely_originator, spread_pattern, similar_recent_posts[]}`). Cross-references `country_parties.is_ruling=false` rows so opposition-party attribution is grounded.

On success updates `opposition_items` and moves `status → 'analyzed'`.

## Response-plan generation

`generateOppositionResponsePlan({ itemId })` — separate server fn, admin-triggered from the detail view (also auto-runs once after Origin pass when `severity >= 3`).

Prompt combines: item analysis + country's ruling-party manifesto (`country_manifestos`) + active `strategy_statements` + recent released `comms_artifacts` for tone. Structured JSON output matches `opposition_response_plans` columns.

The generated plan includes a one-click **"Draft this into Comms Library"** action per `channel_plan[]` row — creates a `comms_artifacts` draft prefilled with the recommended key messages and links back via `linked_artifact_ids`.

## Detail view

`opposition/$id` layout:
- Header: thumbnail (if image), submitted-by, channel, date, severity/sentiment stat strip.
- **Motivation** card (PrettyJson-safe rendering of themes; CitedText for narrative).
- **Origin & amplification** card with platform badges.
- **Recommended response** panel (posture chip, key messages, Day 0/+1/+3/+7 timeline, channel plan table).
- Actions: Regenerate analysis · Regenerate plan · Draft into Comms Library · Archive.

All AI outputs render through `<PrettyJson>` where structured, and `<CitedText>` where prose — respecting the global citation-marker contract.

## Second Brain integration

- Every analyzed item writes a `memory_objects` row (`kind='threat'`, `scope_key=country_code`, `visibility='private'`, verified=false) so Counsel/Ask can surface "we saw this narrative last week" when relevant.
- Response plans do **not** auto-publish — they seed drafts in `comms_artifacts` under the existing draft_state flow so approvals + Ledger re-verification still gate release.

## Files

- `supabase/migrations/<ts>_opposition_intel.sql` — tables, RLS, GRANTs, private trigger, storage bucket (via tool call).
- `src/lib/narrative/opposition-intake.functions.ts` — `createOppositionItem`, `listOppositionItems`, `getOppositionItem`, `archiveOppositionItem`.
- `src/lib/narrative/opposition-analysis.server.ts` — 3-pass pipeline + `generateOppositionResponsePlan` helper.
- `src/lib/narrative/opposition-plan.functions.ts` — `analyzeOppositionItem`, `generateOppositionResponsePlan` server fns (admin + country-member gated).
- `src/components/narrative/opposition/OppositionIntakeDropZone.tsx`
- `src/components/narrative/opposition/OppositionRail.tsx` (list rail for the sidebar)
- `src/components/narrative/opposition/OppositionDetail.tsx`
- `src/routes/_authenticated/admin/countries.$code.narrative.opposition.tsx` (index)
- `src/routes/_authenticated/admin/countries.$code.narrative.opposition.$id.tsx`
- Edit `src/routes/_authenticated/admin/countries.$code.narrative.tsx` — add the Signals/Opposition segmented toggle and swap the rail body accordingly.

## Out of scope

- Public-facing (non-admin) opposition intake.
- Automated social-media scraping / real-time listening — this is inbound-only for now.
- Auto-publishing counter-campaigns — always routes through Comms Library approvals.
- Historical opposition archive analytics — will be a follow-up once volume justifies it.
