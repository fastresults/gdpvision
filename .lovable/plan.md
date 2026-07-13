## Goal
Let the research pipeline escape the fixed allowlist when official sources are thin: do a genuine open-web pass, and when it produces a usable fact, promote the citing domain into the authorized set and record it in the citation trail.

## Current behavior (what we're changing)
- `perplexity.server.ts` hard-filters every extraction call through `OFFICIAL_DOMAINS` (+ country TLD + per-stage overrides). If official portals are missing, we starve and fall to Gemini repair / seeds.
- Citations are captured but never feed back into the allowlist — every stage re-derives the same narrow filter.
- "Authorized domains" today is an in-code constant, not data. There's no per-country learned allowlist.

## Proposed behavior
Three-phase Tier-1 (Perplexity) with a learned allowlist:

1. **Filtered pass** (current) — `sonar-pro` restricted to official + country TLD + learned domains.
2. **Open-web pass** (new) — if filtered pass returns empty/invalid, re-run with NO `search_domain_filter`, `search_mode: "web"`, higher `search_context_size`, using `sonar-reasoning-pro` for extraction + `sonar` for discovery. Prompt explicitly asks the model to prefer primary/official sources and to justify each fact with a citation.
3. **Domain promotion** — for any fact accepted from the open-web pass, extract the citation host, score it (see rules below), and if it passes, upsert into a new `country_authorized_domains` table. Subsequent stages/runs for that country automatically include those domains in the filter.

Gemini repair (Tier 2) and inference seeds (Tier 3) stay as-is, but Tier 2 now also receives open-web citation text.

## Domain promotion rules
A citation host is promoted when ALL hold:
- Not on a global blocklist (social, forums, content farms, AI-generated site list, `*.blogspot.*`, `medium.com`, `reddit.com`, `quora.com`, `wikipedia.org` — wiki is useful but never "authoritative", handled separately as tier="reference").
- Registrable domain reachable (HEAD 200/301/302) and returns HTML.
- Either: (a) government/multilateral TLD (`.gov*`, `.int`, `.edu`, `oecs.org`, `caricom.org`, `imf.org`, `worldbank.org`, `un.org`, `.eu`), OR (b) cited by ≥2 independent stages for the same country, OR (c) matches a known-publisher list (national newspapers per region — small curated seed).
- Stored with `tier`: `official` | `reference` | `press`, `first_seen_stage`, `citation_count`, `last_used_at`.

Wikipedia and similar reference wikis are allowed as `reference` tier — usable for context and cross-check, never as sole source for a committed fact.

## Citation surface changes
- `onboarding_citations` gains `domain_tier` (`official|learned|reference|press|open-web`) and `promoted_domain` (bool) so the UI can badge where a fact came from.
- `PrettyJson` citation modal shows the tier badge; admin can one-click demote a domain (removes from learned list, flags all facts sourced solely from it for review).

## Schema (single migration)
```sql
create table public.country_authorized_domains (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  domain text not null,
  tier text not null check (tier in ('official','learned','reference','press')),
  first_seen_stage text,
  citation_count int not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (country_code, domain)
);
-- GRANTs + RLS: authenticated read for country members, service_role all, admin write.
alter table public.onboarding_citations
  add column domain_tier text,
  add column promoted_domain boolean not null default false;
```

## Code changes
- `perplexity.server.ts` — add `runOpenWebPass()`; `callSonar` accepts `mode: 'filtered'|'open'`; loads learned domains from DB and merges into filter.
- `fallback.server.ts` — orchestration becomes: filtered → open-web → Gemini repair → inference. Only escalate to Gemini if BOTH Perplexity passes fail validation.
- `domain-promotion.server.ts` (new) — `evaluateAndPromote(countryCode, stage, citations)` runs the rules above and upserts.
- `agents.functions.ts` — after each stage commit, call `evaluateAndPromote`; stamp `domain_tier` / `promoted_domain` on saved citations.
- `country-context.server.ts` — `buildCountryContext` includes `learnedDomains` from the new table so all stage prompts know about them.
- Admin onboarding UI — citation badges + a "Learned sources" panel on the country onboard page with demote action.

## Guardrails
- Open-web pass never runs for PII-sensitive stages (Minister personal contact/bio); those stay filtered to official + press tier only.
- Every promoted domain logs an `audit_log` entry with the stage + fact that promoted it, so demotion is auditable.
- If open-web returns a fact that contradicts a filtered-pass fact, we keep the filtered fact and record the open-web one as `alt_source` on the citation for admin review, never silently overwriting.

## Out of scope for this plan
- Full-text crawl/scrape of promoted domains into the corpus (that's the existing Firecrawl ingest path, unchanged).
- Cross-country domain sharing (per-country only for now).

## Deliverables
1 migration, 1 new server module, 1 new UI panel, edits to 4 existing server files, edits to 1 route file. Est. ~45 min.
