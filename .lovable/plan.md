# Why the Caribbean Indices score 0 / 0 / 0 / 2 — and the fix

## What the data shows (published October 2026 edition)

The scoring formulas are working. Each index refuses to score a country unless every pillar has at least two-thirds of its indicators filled. Three gaps stop that from happening:

1. **No evidence has been entered at all.** The evidence store holds 0 entries. 24 of the 49 indicators are "evidence" items (FATF/CFATF status, EU list, FOI law, budget timing, Auditor-General report, ICSID/New York Convention, online company registration, and others). With none filled:
   - **Governance (CGV):** every pillar (delivery, accountability, integrity) is almost entirely evidence, so 0 of 22 score. Only the WGI score arrives automatically (16 countries).
   - **Capital (CCX):** "entry" and "protection" are all evidence, so 0 of 22 score, even though trade, credit and FDI data arrived.
2. **Growth (CGX) is parked by licence.** Six IMF series were parked on 19 Oct because IMF commercial reuse needs written permission, and the three "diversification" items depend on sources not yet approved. Every CGX pillar is below the threshold, so 0 of 22 score.
3. **Human (CHX) is partly parked and partly thin.** 4 of its 14 indicators are pending a source, so pillars with 2–3 items fail as soon as one World Bank value is missing or stale. Only Barbados and Saint Lucia clear every pillar.

## The fix

### Step 1 — Fill the evidence (unlocks CGV and CCX)
- Add an "Draft evidence with AI" action in Admin → Caribbean Indices → Evidence that researches each evidence indicator per country through the existing research gateway and fallback waterfall. Each value must carry a working source link and a quote from that source.
- Drafts are saved as **unverified**. A steward confirms or rejects each one in the Evidence tab. Only verified evidence counts in an official edition. Nothing is invented: when no source is found, the item stays empty and is labelled "no source found".
- Show a progress count per index ("CGV: 186 / 264 drafted, 40 verified").

### Step 2 — Replace the parked IMF series with openly licensed equivalents (unlocks CGX)
Move these to World Bank WDI series, which are CC BY 4.0 like the other inputs:
- Real growth (5-year) and growth volatility: `NY.GDP.MKTP.KD.ZG`
- Inflation band: `FP.CPI.TOTL.ZG`
- Current account: `BN.CAB.XOKA.GD.ZS`
- Public debt and fiscal balance: `GC.DOD.TOTL.GD.ZS` and `GC.NLD.TOTL.GD.ZS`, with ECCB published tables as evidence where WDI has gaps

This change is recorded as method v1.1 with a note, because it changes sources. Diversification stays parked until a national-accounts source is approved, so CGX will still need a decision (step 4).

### Step 3 — Close the CHX gaps
- Fill the pending CHX items with WDI/WHO/UNESCO series under open licences. Price level uses the World Bank ICP 2021 dataset.
- Show "stale" inputs separately from "missing" ones in the run report, so stewards can see what a newer year would fix.

### Step 4 — Decisions needed from you
- **CGX diversification pillar:** keep requiring it (CGX stays unscored until a source exists), or temporarily score CGX on the pillars that have data, with a visible "partial method" flag. By default nothing changes until you decide.
- **IMF permission:** optionally email copyright@imf.org. If permission arrives, the IMF series can return.

### Step 5 — Verify
- Run one watch run after steps 2–3 and report scored counts per index.
- After stewards verify the evidence, a new edition run (not published) should show CGV and CCX scoring for most countries.

## Expected result
- CGV and CCX: most of the 22 countries score once their evidence is verified.
- CHX: roughly 10–18 countries score.
- CGX: depends on the decision in step 4.

## Technical details
- Evidence drafting is a new protected server function in `src/lib/indices/evidence.functions.ts`, using `requireSupabaseAuth` and a global steward check. It writes to `index_evidence` with `verified=false` and upserts on (country, indicator) so re-running never creates duplicates.
- Indicator swaps are database updates to `index_indicators` (source_kind, source_code, licence, status=active), plus a `method_version` bump on CGX/CHX in `index_specs`. No schema migration is expected.
- Add tests in `src/lib/indices/scoring.test.ts` for the two-thirds threshold and for unverified evidence being excluded from editions.
- Then `bun run headers && bun run map`.
