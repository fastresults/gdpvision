# Correct the Narrative Chamber signal total

## Finding

The scan did add records. Antigua & Barbuda now has **3,709 stored signals**, including **43 added in the last 24 hours**. After duplicate/cluster filtering, **3,062 signals are eligible for the active signal view**, including 30 from the latest day.

The visible number stayed at **200** because the page deliberately loads only the newest 200 records, then uses that array length as though it were the full total. The radar centre, “Signals” tab, and “Active signals” label all inherit that capped number.

## Plan

1. Return two distinct values from the signal query:
   - the newest 200 records for the fast, usable triage rail and radar dots;
   - the complete filtered signal count for Antigua & Barbuda.
2. Display the true complete count in the “Signals” tab and “Active signals” label.
3. Make the radar explicit about its visual sample: show the newest 200 plotted signals while retaining the full active total in the centre/summary, so the diagram remains readable and honest.
4. Keep duplicate and clustered sibling exclusions exactly as they are; this is a counting/presentation correction, not an ingestion-rule change.
5. Verify that a manual refresh increases the complete total when genuinely new primary signals are promoted, while duplicates do not inflate it.

## Technical notes

- Preserve the current newest-first 200-row limit for rendering performance.
- Obtain the matching filtered total with an exact database count using the same country, primary-story and non-duplicate conditions.
- Update all consumers together so the sidebar, radar and triage wording cannot disagree.
