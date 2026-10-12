# Refresh and ingest the latest Antigua press mentions

## Recommendation

Run this as a controlled Antigua-only catch-up, not another global sweep. The latest global scan at 12:15 UTC fetched 858 new items but promoted none because the press classifier stopped when its Perplexity credits were exhausted. Antigua currently has 18 active feeds, 52 items still waiting to be classified, and no newly promoted signal in the last seven days.

## Plan

1. **Make classification resilient**
   - Route press classification through GDPVision’s existing research fallback path instead of ending the run when Perplexity is unavailable.
   - Preserve the current structured fields: scope, sector, severity, reach, sentiment, topic, summary, recommendation, rationale and citations.
   - Stop safely on credit or access failures, keep unprocessed mentions queued, and surface the real blocker rather than marking the scan successful.

2. **Run an Antigua-only source refresh**
   - Recheck the 18 active local, regional and international feeds.
   - Revive or replace eligible failed feeds through the existing discovery process without duplicating source records.
   - Record fetched, new, duplicate, promoted and failed totals for this run.

3. **Ingest the backlog and newest mentions**
   - Process the 52 queued Antigua items plus genuinely new results in bounded batches.
   - Keep URL canonicalisation and story clustering so repeated coverage becomes supporting coverage, not duplicate signal cards.
   - Promote classified primary stories into the Narrative Chamber while preserving citations and source lineage.

4. **Make the result clear in the Narrative Chamber**
   - Refresh the signal list, 24-hour radar and coverage figures after the run.
   - Show an explicit completed, partial or blocked outcome with counts, so “Coverage 0/22” cannot mask a fetched-but-unclassified backlog.

5. **Verify the catch-up**
   - Confirm Antigua’s latest run has a completion time and accurate totals.
   - Review a sample across local, regional and international coverage for relevance, duplicates, source links and classification quality.
   - Confirm rerunning the catch-up creates no duplicate press mentions or signals.

## Technical notes

- Keep the existing authenticated manual-run boundary and Antigua country-role check.
- Keep work bounded and idempotent; do not add another scheduled job.
- Use the existing `narrative_feeds` → `narrative_feed_items` → clustered `intake_items` pipeline.
- Update the Chamber 05 map only if the server-function surface changes.
