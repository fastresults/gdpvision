# Read the whole website for a data source

## What's true today
- `https://ab.gov.ag/index.php` ("eGov Platform") was added through Add source by a signed-in account at 06:36 UTC. It has never been fetched: 0 documents, 0 passages.
- The existing "Re-ingest" action reads only the single page at the link, and each source can hold only one document.

## What you'll get
- A **"Read whole site"** button on each link source (in the source detail panel), next to Re-ingest.
- Options before it starts: page limit (default 100, max 500) and "stay on this website" (always on). A confirmation shows the estimated number of pages.
- A progress line on the source: "Reading… 34 of 100 pages", then "Read 87 pages · 1,240 passages · 6 skipped".
- Each page is filed separately with its own address and title, so answers can cite the exact page.
- Re-running is safe: an unchanged page is skipped and a changed page replaces its old copy, so nothing is ever duplicated.
- The page list is visible in the source detail panel (address, title, size, status), with failures and their reasons.
- Then run it once on ab.gov.ag and report the actual counts to you.

## Technical details
- **Migration:** on `country_source_documents`, drop the one-document-per-source UNIQUE on `country_source_id`, add `page_url text` + `page_title text`, and add a unique index on `(country_source_id, normalized page_url)` (normalized = lowercase host, no fragment/trailing slash/tracking params). Backfill existing rows with `page_url = source.url`. Add `crawl_status`, `crawl_progress jsonb` on `country_sources`. Existing grants/RLS are kept.
- **Server:** `ingest.server.ts` gets `startFirecrawlCrawl(url, {limit, includeSubdomains:false})` and `pollFirecrawlCrawl(id, next)` against Firecrawl v2 `/crawl`, following the same key mode as the current scrape. New `crawlSource` / `crawlSourceStep` server fns in `manage.functions.ts` (admin-only via `assertAdmin`): start the job, then the client polls a step fn that fetches the next batch of finished pages, upserts each page on the normalized key, skips when `content_hash` is unchanged, replaces chunks for changed pages, embeds in batches of 64, updates progress. Polling in small steps keeps each call short enough for the server's time limits.
- Pages are filtered through `safe-url` and kept to the source's host; empty/very short pages are skipped.
- Visibility and ownership are copied from the parent source on every document and chunk.
- `reingestSource` updated to upsert its single page by the same key instead of deleting all documents (so it doesn't wipe a site-wide read).
- UI: `SourceDetailSheet.tsx` button, options dialog, progress, page list; uses `btn-*` classes.
- Update `docs/map/corpus.md` dedup key for documents; run headers/map/typecheck; verify in the browser as an admin on ATG.
