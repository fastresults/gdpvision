# GDP Advisor access to the Second Brain (all countries, public data)

## Recommendation
Do both, in this order, on one shared data layer:
1. **REST API (v2 "partner" API)** — the backbone GDP Advisor's website calls for pages, dashboards and caching. Predictable, cacheable, easy to monitor.
2. **MCP server** — sits on the same layer so GDP Advisor's AI assistant (or any AI tool) can search and reason over the Second Brain conversationally.

GDPVision already has a read-only public API for one country per key (brand, KPIs, commitments, ministries, sectors, datasets, procurement, projects, brain, sources), which already strips drafts, persona data, narrative signals and private records. We extend that rather than building new rules.

## What GDP Advisor gets
- One **partner key** covering all countries (or a chosen list), managed in Admin with scopes, allowed website origins, rotation and revoke.
- Endpoints:
  - `GET /api/public/v2/countries` — directory of countries with coverage counts and last-updated.
  - `GET /api/public/v2/countries/:code/:resource` — same resources as v1, same envelope, `?since=` incremental sync, pagination.
  - `GET /api/public/v2/search?q=&country=&sector=` — search across public Second Brain records with source links.
  - `GET /api/public/v2/compare?metric=&countries=` — cross-country KPI comparison (peer benchmarking).
- MCP tools (read-only): `list_countries`, `get_country_profile`, `get_kpis`, `search_second_brain`, `compare_countries`, `get_sources`. Each answer carries citations.

## Safeguards
- Public-only: only rows marked public/approved; same filters as v1, enforced in one shared module.
- Keys stored hashed, per-key rate limits, usage log visible in Admin, CORS limited to GDP Advisor's domains.
- MCP access: protected by sign-in (OAuth) or the partner key; it will never expose protected memory titles/contents beyond what the public API shows. (I'll confirm the access choice with you before building it.)

## Rollout
1. Shared public data layer + partner key type + Admin key management.
2. v2 REST endpoints + short developer doc page for the GDP Advisor team.
3. MCP server reusing the same layer.
4. Test end-to-end with a GDP Advisor key; republish.

## Technical details
- Extract resource handlers from `src/lib/egov/api.server.ts` into `src/lib/public-data/*.server.ts`; v1 keeps working unchanged.
- New migration: `partner_api_keys` (hashed key, country allow-list or `*`, scopes, origins, rate limit) + `partner_api_usage`, with grants, RLS (admin-only) in the same migration.
- Routes under `src/routes/api/public/v2/*` verify the key inside each handler.
- MCP via `@lovable.dev/mcp-js` at `/mcp`, tools in `src/lib/mcp/`, calling the shared layer.
- Update `docs/map/*` and AGENTS.md rule for the shared public data layer.
