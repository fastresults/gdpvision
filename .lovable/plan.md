## Goal

Split every corpus row into **public** (shared across the platform) and **private** (visible only to the owning country's admins/users), across ingest, storage, retrieval, and UI. Everything currently in the corpus stays **public**; a new admin upload path introduces **private** at the moment of upload.

## Data model

Add to every corpus table that holds country intelligence:

```text
visibility   text  NOT NULL DEFAULT 'public'  CHECK (visibility IN ('public','private'))
owner_country_code text NULL      -- required when visibility='private' (trigger)
uploaded_by  uuid  NULL           -- auth.users id at private upload time
```

Tables touched (all backfilled to `public`):
- `country_sources`, `country_source_documents`, `country_source_chunks`
- `memory_objects`, `country_kpis`, `country_kpi_points`
- `sector_dossiers`, `ministry_profiles`
- `onboarding_citations`, `country_capital_flows`, `capital_flow_research_attempts`
- `citations` (already has `owner_type/owner_id`; add `visibility`)

Add `has_country_access(uid, code)` SECURITY DEFINER helper reading `user_roles` (`country_admin` or `country_user` with matching `country_code`, plus platform `admin`).

RLS rewrite per table (SELECT):
```sql
USING (
  visibility = 'public'
  OR public.has_country_access(auth.uid(), country_code)
)
```
INSERT/UPDATE/DELETE policies gated by `has_country_access` for `private`, and by existing admin roles for `public`. Add a BEFORE INSERT/UPDATE trigger enforcing `visibility='private' ⇒ owner_country_code = country_code AND uploaded_by IS NOT NULL`.

## Ingest paths

- **Onboarding orchestrator, deep-research, self-heal, capital-flow acceptance, corpus writers** (`src/lib/corpus/writers.server.ts`, `src/lib/country-onboarding/*`, `src/lib/ledger-qa/*`, `src/lib/country-data/sources.server.ts`): thread an explicit `visibility: 'public'` on every insert/upsert. All web-scoured data stays public — no change in behavior, just an explicit tag.
- **New private upload path**: extend `AddSourceDialog` / `AddMemoryDialog` / documents upload with a required "Visibility" control (Public / Private to this country). On submit, server fn stamps `visibility='private'`, `owner_country_code=<code>`, `uploaded_by=auth.uid()`. Private PDFs go to a `private-corpus/{country}/` storage prefix with signed-URL-only access; public assets keep current bucket layout.
- Dedupe keys change to `(country_code, visibility, <existing key>)` so a public row and a private row with the same URL/title can coexist without collision.

## Retrieval paths

Every reader that composes corpus context must filter to `{public} ∪ {private WHERE country_code = ctx.countryCode AND has_country_access}`:
- `src/lib/corpus/searchers/*.server.ts` (memory, ministry, sector, kpi, flow, citation, dossier)
- `src/lib/corpus/gateway.server.ts`
- `src/lib/counsel.functions.ts`, `src/lib/dossier.functions.ts`, `src/lib/narrative.functions.ts`, `src/lib/traceability.functions.ts`, `src/lib/factcheck.functions.ts`, `src/lib/briefing.functions.ts`, `src/lib/ledger.functions.ts`, `src/lib/country-viz/*`
- `src/lib/country-data/consume.functions.ts` and `manage.functions.ts`
- Public hooks in `src/routes/api/public/hooks/*` and the `/kiosk` data route must serve **public-only** (no session ⇒ no private).

Retrieval helper `withVisibilityScope(query, { countryCode, userId })` centralizes the filter so no call site can forget it. `applySourceSuppressions`-style pattern.

## UI

- Every corpus surface (SourceDetailSheet, MemoryVisual, BrainConstellation, CitationsRail, dossier, KPI cards, ministry cards, Sankey, Ledger) shows a **Public / Private** badge and filters by a scope toggle (`All`, `Public`, `Private`).
- Upload dialogs get a Visibility radio with a short explainer ("Private data is only visible to your country's team"). Default = Public for admin-triggered research runs; default = Private for direct uploads.
- Steward tools / publish gate blocks publishing a public artifact that cites private sources (fail-closed with an explicit reason).

## Acceptance / self-heal

- Twelve-step acceptance runs against **public** corpus only for the public-hook verdict; a second internal pass includes private for the country admin view.
- `verify.sh`/`verify_assert.py` gain assertions: no `private` row is exposed through a public hook fetch; every private row has `owner_country_code` and `uploaded_by`.

## Migration order (single migration, then code)

1. Add columns + trigger + `has_country_access` + rewrite RLS on all listed tables. Grants: `authenticated` full CRUD (RLS enforces), `anon` SELECT only where public policy allows.
2. Backfill `visibility='public'` for every existing row; leave `owner_country_code` NULL for public rows.
3. Ship code changes: writers stamp `public`, new upload path stamps `private`, all readers go through `withVisibilityScope`, UI badges + toggle + upload control.
4. Playwright smoke: (a) country admin uploads a private PDF → visible in their dossier, invisible on public hook; (b) other-country user cannot read it; (c) existing public corpus unchanged.

## Out of scope

- No new per-row ACLs beyond country scope (no per-user sharing).
- Encryption at rest for private uploads uses the standard Storage bucket; no client-side E2E encryption.
- No re-classification workflow yet (private → public) — will be a follow-up admin action.