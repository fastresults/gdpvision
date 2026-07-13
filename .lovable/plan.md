## What's happening

The `Corpus ingest health` panel shows two distinct problems from the last `Run AI research`:

**1. 22 × `Firecrawl 400: Invalid URL` (red rows).**
These `country_sources` rows still contain **search-hint sentences** in their `url` column (e.g. `"Saint Lucia Ministry of Equity official page (via Government of Saint Lucia portal)"` and `"…(search: \"Saint Lucia CIP government\")"`). They were written by the research agent before URL validation was added to `commitSourceRegistry`, and they are still `active=true`, so every re-run of `runCorpusIngest` re-sends them to Firecrawl and Firecrawl rejects each one with a 400.

The `Clean invalid URLs` button already exists to deactivate them, but:
- the admin has to remember to click it, and
- the ingest itself does not pre-filter, so one bad batch keeps producing 22 red failures per run.

**2. `imf.org/countries/LCA` and `data.worldbank.org/country/LCA` returned `ok · 0 chunks` (green but empty).**
`fetchFirecrawl` reads the Firecrawl **v1** response shape (`json.data.markdown` + `json.data.metadata`). The endpoint we call is **v2** (`/v2/scrape`), whose successful body puts `markdown`, `html`, `metadata`, etc. at the **top level** (`{ success, markdown, metadata, ... }`), with no `data` wrapper. So `doc.markdown` comes back as `""`, hits the `< 200 chars` guard, is caught and marked as `too short` — or, if a prior document with the empty hash exists, the dedup branch fires and records `ok, chunks: 0`. Either way, no real content is ingested from otherwise-valid sources.

## Fix plan

### A. `src/lib/country-onboarding/ingest.server.ts` — read Firecrawl v2 shape

In `fetchFirecrawl`, replace the v1-only extraction with a v2-first read that also tolerates the legacy `data.*` wrapper:

```
const body = await res.json();
const root = body?.data ?? body;                  // v2 top-level, v1 nested
const markdown = root?.markdown ?? "";
const meta = root?.metadata ?? {};
const title = meta.title ?? url;
const src   = meta.sourceURL ?? meta.url ?? url;
```

Also treat `body.success === false` as an error (Firecrawl sometimes returns 200 + `success:false` with an `error` string) and include the message in the thrown error so the health panel is actionable.

### B. `src/lib/country-onboarding/corpus.functions.ts` — pre-flight URL filter in `runCorpusIngest`

Right after loading `sources` and before the scrape loop:

1. Partition `sources` into `valid` and `invalid` using the existing `isValidHttpUrl(src.url)`.
2. For every `invalid` row: `update({ active: false, fetch_status: 'invalid_url', fetch_error: 'not a valid http(s) URL' })` in one batch, and push a `results` entry `{ ok: false, error: 'invalid url (auto-deactivated)' }` so the health panel shows what happened.
3. Iterate only over `valid` for the Firecrawl loop; update `total` and the heartbeat `plan` counters accordingly (so `processed n/m` reflects the real work).

This makes every subsequent run self-healing — the admin never has to click `Clean invalid URLs` again for agent-written garbage, and the 22 rows on LCA get flipped inactive on the next run.

### C. Health panel copy tweak (same file, stage 10 render)

- Split the summary line into `ok N · dedup D · fail F · skipped S · chunks C · processed n/m`, where `dedup` counts rows with `ok:true && chunks===0` and `skipped` counts the auto-deactivated invalid URLs. Today those two both show up as ambiguous green / red rows.
- For rows where `error` starts with `invalid url`, render a neutral gray dot (not red) and the label `deactivated: invalid URL` so the panel distinguishes "bad data we cleaned up" from "Firecrawl actually failed".

### D. No schema, no new tables

All changes are in the two files above. `country_sources.fetch_status` already accepts free-form strings, so `'invalid_url'` needs no migration. The existing `cleanInvalidCountrySources` server fn and `Clean invalid URLs` button stay as a manual escape hatch but should rarely be needed after B.

## Verification

1. Reload `/admin/countries/LCA/onboard`, expand stage 10, click **Run AI research**.
2. Sticky banner ticks; on completion the health panel shows something like `ok 2 · dedup 0 · fail 0 · skipped 22 · chunks >0 · processed 3/3` (the 22 hint-string rows are now deactivated and excluded from `total`).
3. The `imf.org` and `worldbank.org` rows show `ok` with a **non-zero** `chunks` count — proving the v2 body parse works.
4. Re-run immediately: same 3 valid sources, `dedup 2/3` (content_hash match), still zero red rows.
5. Query `select count(*) from country_sources where country_code='LCA' and active=false and fetch_status='invalid_url'` → 22.

## Out of scope

- Rewriting the research agent's source-emission prompt (that already gets validated at `commitSourceRegistry`; auto-deactivation in B is enough for now).
- Any changes to embeddings, chunking, dedup thresholds, PrettyJson, citations UI, or accordion scroll behavior.
