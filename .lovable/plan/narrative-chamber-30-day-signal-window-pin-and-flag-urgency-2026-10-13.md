# Narrative Chamber: 30-day signal window, pin and flag, urgency ranking

## The comms logic

A press desk works on what is live. After 30 days a story is either part of the record (keep it on purpose) or noise. So:

- **Live window = last 30 days.** Only these show on the rail, radar, tiles and groups.
- **Pin = "keep in view".** A story the team keeps coming back to (an ongoing issue, a running crisis). Pinned items sit at the top of their priority group.
- **Flag = "needs action".** Someone must respond, check facts or brief the Minister. Flagged items get a red marker and their own filter.
- **Day 31 = deleted**, unless pinned or flagged. Kept items show a "Kept past 30 days" label.

Current scale: about 141,000 Antigua-and-region signals, about 139,000 older than 30 days. The first cleanup removes almost all of them, so step 1 comes first.

## Plan

1. **Safety first.** Before any deletion, auto-pin every older signal that already has a comms draft, response plan or dossier, so no working material is lost. Report the count before the first cleanup runs.
2. **Pin and flag on every signal.**
   - Pin and flag icons on every rail row and in the signal detail header. One click toggles them; the change shows at once.
   - Optional short flag note ("Brief PS by Thursday"). It records who flagged it and when.
3. **Confirm before data is lost.** Unpinning or unflagging a signal older than 30 days (with nothing else keeping it) opens a confirmation: "This story is 47 days old. Removing the pin means it will be permanently deleted at the next daily cleanup." Buttons: Keep it / Remove and allow deletion. Signals 30 days old or newer toggle without a prompt.
4. **Rail filters:** All live · Pinned · Flagged · Kept past 30 days. A strip shows counts for each, plus "Expiring in 3 days" so the team can save anything still needed.
5. **Urgency ranking inside each group (P1 to P5):**
   1. Pinned and flagged items, then flagged, then pinned
   2. Severity and reach (combined impact)
   3. Most recent first
   4. Age penalty: older items move down within the same tier

   The tiles, group headers and radar all count the same 30-day set, plus kept items.
6. **Daily cleanup** runs once a day. It deletes unpinned, unflagged signals older than 30 days, logs how many were removed per country, and shows "Last cleanup: today, 1,204 removed" in the chamber.

## Technical details

- Migration (additive): add `pinned_at`, `pinned_by`, `flagged_at`, `flagged_by`, `flag_note` (nullable) to `intake_items`, a partial index on `(scope_key, created_at desc) where pinned_at is not null or flagged_at is not null`, and a retention log table with GRANTs, RLS and policies in the same migration.
- Update `narrative_priority_counts` and `narrative_signal_ids_at_priority` to filter `created_at >= now() - 30 days OR pinned OR flagged`, and order by tier, then score, then `created_at desc`. `listSignals` and the count use the same filter. Bump the query key version.
- `toggleSignalMark` server function (requireSupabaseAuth, steward or admin). It returns `willExpire` so the client can show the confirmation, and re-checks on the server.
- Purge: a security-definer `purge_stale_signals()` deletes in batches of 5,000. `dossier_questions` rows are deleted with their signal; lineage, feed-item and cluster links are set to null. Comms artifacts are protected by step 1. It is triggered by a `/api/public/hooks/narrative-retention` route that checks the hook secret, scheduled daily with pg_cron. The first run is batched until the backlog is cleared.
- `sortSignals` gains the pin and flag tier. `PriorityPill` and `SignalRow` gain the icons. Update docs/map and the AGENTS.md retention rule.
- Verify with a signed-in Playwright run: toggle, confirm prompt on an old item, ordering inside P1, and counts that match after a test purge on a small country first.
