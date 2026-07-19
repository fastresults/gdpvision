## Remove redundant sector code caption

In `src/components/viz/SectorProfilingMatrix.tsx`, each sector row currently shows the human label ("Tourism") with the raw slug ("TOURISM") right below it — redundant and noisy when the slug just echoes the title.

### Change
Drop the uppercase slug from the sector cell, keeping only the KPI hint when present.

- File: `src/components/viz/SectorProfilingMatrix.tsx`
- Remove the `{r.code}` token from the small mono line under the sector title.
- If `r.kpi_label` exists, keep it as the sole caption (without the leading `·` separator).
- If no KPI label exists, render nothing in that slot (title-only row).

No other columns, styles, or data flow change.