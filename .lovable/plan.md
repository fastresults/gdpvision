## Diagnosis

Stage 6 (source_registry) committed with **0 rows inserted** into `country_sources`, so from the UI it looks like everything vanished. Nothing was "lost" — nothing was ever saved.

Evidence pulled from the DB for BRB run `17c1f0fa…` / draft `8fc7d5ff…`:
- `payload.sources` has **31 entries**.
- Of those 31, **0 have a valid `https://…` URL** — every `url` field came back as an empty string (Perplexity produced org / title / rationale, no URL).
- The commit handler (`commitSourceRegistry` in `corpus.functions.ts` ~L297) runs `isValidHttpUrl(s.url)` per row and pushes each empty‑URL row into `rejected`, then calls `markDraftCommitted`. All 31 land in `rejected`, `inserted = 0`, run is marked `committed`, draft is closed. `country_sources` for BRB → 0 rows.

Two independent bugs together cause "lost everything":

1. **Extraction bug** — the Perplexity prompt / JSON schema for `source_registry` does not enforce a real URL. `url` is declared `type: "string"` with no `format: "uri"` and no minLength, and the system prompt never says "url must be a working https URL". The model happily returns `"url": ""` for every entry.
2. **Commit bug** — when every row is rejected, the commit still marks the draft `committed` and returns success. The user sees a green tick and an empty table. There is no guard that says "if 0 inserted, don't close the draft" and no visible surfacing of the `rejected` list in the UI.

## Plan

### 1. Fix the extractor so URLs are always present (`corpus.functions.ts`)
- Tighten `SourceRegistrySchema.properties.sources.items.properties.url` to `{ type: "string", format: "uri", pattern: "^https?://", minLength: 8 }`.
- Reinforce the system prompt for `runSourceRegistryAgent`: "Every source MUST include a working absolute https:// URL to the organisation's homepage or the specific resource. NEVER return an empty url. If you cannot find a URL for a candidate, drop it."
- After `parseSonarJson`, drop any entry whose `url` doesn't pass `isValidHttpUrl` **before** saving the draft, and if fewer than 10 valid sources survive, retry once with `sonar-pro` (open web) as a Tier‑2 pass rather than saving a mostly‑bad draft.

### 2. Fix the commit so a zero‑insert commit cannot silently close the stage (`corpus.functions.ts`, `commitSourceRegistry`)
- If `inserted === 0`, do **not** call `markDraftCommitted`. Throw `Error("Commit rejected: 0 valid sources — every row failed URL validation. See rejected list.")` and include the first 3 rejected entries in the message. Draft stays open so the user can edit or re‑run.
- If `inserted > 0` but `rejected.length > 0`, still commit, but return `{ ok, inserted, rejected }` (already done) and surface it in the UI.

### 3. Surface the rejected list in the onboarding UI (`countries.$code.onboard.tsx`)
- On commit response, if `rejected.length > 0`, render a small warning block under the stage showing count + first few URLs / reasons so the user knows why the number is lower than the draft count.
- On commit error (0 inserted case above), toast the error and keep the draft view open.

### 4. Backfill BRB (one‑off, no code)
- The current committed draft is unrecoverable (all URLs are empty strings — no data to keep). User re‑runs stage 6 after fix #1 is in, which will now produce a draft with real URLs.

## Technical notes

- Files touched: `src/lib/country-onboarding/corpus.functions.ts` (schema, agent prompt, commit guard) and `src/routes/_authenticated/admin/countries.$code.onboard.tsx` (rejected‑rows warning).
- No DB migration needed — `country_sources` schema already supports what we insert; the failure is upstream.
- `isValidHttpUrl` (already used in commit) is the single source of truth for URL validity; reuse it in the extractor's post‑parse filter so extractor and commit can never disagree.
- No change to `upsertCountrySource` — it's behaving correctly and was never called for BRB stage 6.
