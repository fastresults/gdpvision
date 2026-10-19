# GDP Advisor · Caribbean Indices API and visual routes

GDP Advisor reads the Caribbean Indices through the GDPVision partner API v2 with its existing
partner key (`Authorization: Bearer gdpp_…`). Migration 0040 added the `indices` scope to every
active partner key, so no new key is needed. Method: `docs/prd/PRD-caribbean-indices.md`.

**One rule for every page:** scores come only from **published official editions**. Until the first
edition is published, the score endpoints return `edition: null` and empty `data`, and every page
shows its method content with a "First edition pending" state. Never fill the gap with sample numbers.

## Endpoints

All responses use the v2 envelope `{ version: "v2", generated_at, …body }`.

| Endpoint | Returns | Cache |
| --- | --- | --- |
| `GET /api/public/v2/indices` | Method, Sextant definition, the four indexes with pillars and indicators (source, licence, goalposts, status), and the list of published editions | 1 hour |
| `GET /api/public/v2/indices/{CGX\|CHX\|CGV\|CCX}?edition=latest&countries=ATG,KNA` | League table for one index from a published edition | Until the next edition (editions never change) |
| `GET /api/public/v2/countries/{code}/indices` | All four scores for one country, each with its cited inputs ("why this score") | Until the next edition |

MCP (for GDP Advisor's assistant): `get_index_catalogue`, `get_country_indices`.

### `GET /indices` (shape)

```json
{
  "method": { "standard": "…", "indicator_score": "…", "pillar_score": "…", "index_score": "…", "imputation": "None…", "grades": { "A": "…" }, "publication": "…", "document": "https://…" },
  "sextant": { "name": "Sextant", "parts": [{ "code": "availability", "weight": 0.3, "measures": "…" }], "bands": [{ "band": "clear", "min": 80 }] },
  "indexes": [
    {
      "code": "CHX", "name": "Caribbean Human Index", "pillar_label": "Human Quality",
      "question": "Does growth reach people?", "benchmark": "UNDP Human Development Index",
      "method_version": 0, "method_status": "draft", "aggregation": "geometric",
      "pillars": [
        { "code": "health", "name": "Health", "weight": 1, "position": 1,
          "indicators": [
            { "code": "life_expectancy", "name": "Life expectancy at birth", "unit": "years",
              "goal_best": 85, "goal_worst": 60, "window_kind": "latest",
              "source_kind": "wdi", "source_code": "SP.DYN.LE00.IN", "source_org": "World Bank WDI",
              "source_url": "https://data.worldbank.org/indicator/SP.DYN.LE00.IN",
              "licence": "CC BY 4.0", "licence_status": "confirmed", "indicator_type": "data",
              "age_tolerance_years": 3, "status": "active" }
          ] }
      ]
    }
  ],
  "editions": [{ "id": "uuid", "label": "April 2027 edition", "published_at": "…" }]
}
```

### `GET /indices/{code}` (shape)

```json
{
  "index": "CHX",
  "edition": { "id": "uuid", "label": "April 2027 edition", "published_at": "…" },
  "count": 22,
  "data": [
    {
      "country_code": "BRB", "country_name": "Barbados", "status": "scored",
      "score": 71.4, "rank": 1,
      "pillar_scores": { "health": 74.2, "education": 66.0, "income": 70.1, "living": 75.9 },
      "coverage": { "present": 11, "specified": 14, "by_pillar": { "health": { "present": 2, "specified": 4 } } },
      "not_scored_reason": null,
      "sextant": 68.5, "sextant_band": "fair",
      "sextant_parts": { "availability": 78.6, "timeliness": 61.0, "grade_quality": 50, "source_health": 100 },
      "weakest_grade": "C", "method_version": 1
    }
  ]
}
```

Values above illustrate the shape only. A `not_scored` row has `score: null`, `rank: null` and a
`not_scored_reason` naming the pillars below coverage — show it, don't hide the country.

### `GET /countries/{code}/indices` (shape)

`data` holds one row per index (same fields as above) plus `inputs`: every indicator with
`value_used`, `period`, `score`, `source_org`, `source_url`, `licence`, `grade`, `age_years` and
`excluded_reason` (`pending_source`, `not_collected`, `stale`, `series_too_short`,
`source_unreachable`, `grade_outside_A_D`, `unscorable_value`). `extra.edition` names the edition.

## Visual routes to build on gdpadvisor.com

Slugs: `growth` → CGX · `human` → CHX · `governance` → CGV · `capital` → CCX.

| Route | Purpose | Data | Visuals |
| --- | --- | --- | --- |
| `/indices` | Hub for the four indexes | `/indices` + `/indices/{code}` ×4 | Four index cards (question, latest edition, top three, number scored); a one-line method strip linking to each method page |
| `/indices/{slug}` | One index's league table | `/indices/{code}` | Ranked horizontal bar per country (score), Sextant band shown beside each bar as a pattern, not colour alone; pillar heatmap (countries × pillars); a "not scored" list with reasons |
| `/indices/{slug}/method` | How it is built | `/indices` | Pillar → indicator tree; indicator table with source link, licence, goalposts, window, age tolerance and status (`pending_source` shown honestly) |
| `/countries/{code}/indices` | Country profile | `/countries/{code}/indices` | Four score tiles with rank and Sextant; pillar bars per index; **growth-to-people gap** (CHX rank − CGX rank); "why this score" table of inputs with citations; measurement gaps (excluded inputs grouped by reason) |
| `/indices/sextant` | The measurement table | `/indices/{code}` ×4 | Countries ranked by median Sextant across indexes; stacked bar of the four Sextant parts |
| `/indices/compare?countries=` | Side by side | `/indices/{code}?countries=` | Grouped bars per pillar for 2–4 countries |
| `/indices/editions` | Archive and changelog | `/indices` → `editions` | Edition list; each links to the league tables as published |

Display rules:

- Always print "GDPVision Caribbean {Name} Index" and the edition label on every chart.
- Show the Sextant band next to every score. Hazy and Obscured scores carry the band in words.
- Never interpolate, smooth or estimate a missing value. `not_scored` is a result.
- Every number on a "why this score" view links to its `source_url`.
- Monthly trackers are private to governments and never appear on GDP Advisor.
