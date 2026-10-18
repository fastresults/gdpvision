# src/lib rules

- **Narrative retention**: daily `purge_stale_signals` purges unmarked signals >30d; signal queries share that filter.
- **Partner data (GDP Advisor)**: companion sites read through `src/lib/public-data/partner.server.ts` (v2 API under `/api/public/v2`, partner keys `gdpp_…`, admin at `/admin/partner-keys`), which delegates to v1 resource handlers via `readPublicResource` so one set of public/approved filters governs every external read.
- **Media scan**: shared regional/international outlets feed under pseudo-country `CAR` and fan out to each country the classifier names (`intake_items.countries`); media-only places live in `narrative_media_countries`, not `countries`, so other chambers never see them. Priority score (`narrative-priority-score.ts`) orders within P-levels only, keeping SQL priority counts in step.
- **Business case**: keep claims and source links in `src/lib/business-case.ts`; separate capabilities, pilot tests and contract terms to avoid implying proven results.
