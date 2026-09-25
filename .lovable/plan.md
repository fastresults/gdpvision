# CARICOM vs OECS economic strength comparison

## Recommendation

Add a small chart icon beside both **CARICOM** and **OECS** controls. The bloc name continues to filter the country cards; the icon opens a shared **Economic strength** drawer directly beneath the controls.

The drawer should compare both blocs side by side even when opened from only one icon. The selected bloc receives stronger emphasis, while the other remains visible as context. This is clearer than separate pop-ups and avoids making users remember numbers between views.

OECS overlaps with CARICOM, so the heading must state that these are **overlapping blocs, not mutually exclusive groups**. Each figure will show the included country count, coverage, reference period, and whether the result is a total, weighted average, or median.

## What the user sees

### 1. Attached controls

- Keep the existing **All / CARICOM / OECS** segmented controls.
- Add a compact chart icon inside the CARICOM and OECS segments, separated from the filtering target by a fine divider.
- Clicking the bloc name filters the country grid as it does now.
- Clicking the chart icon expands or collapses the comparison drawer and announces “View CARICOM economic summary” or “View OECS economic summary”.
- On small screens, the drawer becomes a full-width sheet; it is never a blocking modal on desktop.

### 2. Economic strength drawer

Use a restrained annual-report aesthetic: paper surface, fine rules, large editorial figures, and richer colour confined to the charts.

**Header**
- “Economic strength · CARICOM vs OECS”
- Latest common comparison year and last refresh time
- CARICOM and OECS member counts
- A short coverage warning when an indicator excludes members

**Economic scale — paired headline figures**
- Combined GDP
- Combined population
- Combined exports, when coverage supports a defensible total

Show CARICOM and OECS in two aligned columns with proportional horizontal bars. The bar lengths carry magnitude; the printed values carry precision.

**Economic performance — mirrored comparison profile**
- Real GDP growth: GDP-weighted average
- GDP per person: population-weighted bloc value
- Government debt: median % of GDP
- FDI inflows: median % of GDP
- Current-account balance: median % of GDP
- Unemployment: median rate

Use paired horizontal bullet bars on a shared scale, one row per indicator. A subtle semantic gradient may fill each bar, but the endpoint, zero line, and exact number remain explicit so colour never substitutes for quantity.

**Momentum — small multiples**
- Compact two-line trend charts for indicators with at least three comparable annual observations.
- CARICOM and OECS use distinct semantic colours and direct end labels, not a detached legend.
- If history is insufficient, show “Current reading only” rather than inventing a trend.

**Member distribution**
- A dot-strip for each selected indicator, with one dot per country and a larger marker for the bloc median.
- Hover or keyboard focus identifies the country, value, period, and source.
- This prevents a few large economies from making the whole bloc appear uniformly strong.

### 3. Interpretation

A short, fixed **What this comparison means** column explains:
- which bloc has greater economic scale;
- where the smaller bloc is stronger on a per-person or rate basis;
- the widest statistically meaningful gaps;
- where coverage or mixed periods limit the conclusion.

This interpretation should be deterministic from the figures. AI may add a cited explanation only for statistically meaningful gaps already established by the calculation; it must never decide which bloc is stronger.

## Data rules

Use the already-cleaned public indicator copies rather than raw inconsistent values.

- Membership comes from the existing CARICOM/OECS registry.
- Use the latest non-projected observations within a common two-year window.
- Require at least 70% member coverage for a bloc figure; otherwise show it as unavailable.
- Totals are used only for additive measures such as GDP and population.
- Rates use transparent weighted averages when a valid weight exists; otherwise use the median.
- Never average ratios such as debt-to-GDP without labelling the method.
- Keep 2-decimal precision for KPI values and expose every formula through **Explain this**.
- Show member coverage as `n / eligible members` beside every metric.
- Preserve source links and public/private access rules; only public records contribute to cross-country bloc summaries.

## Visual direction

- Keep the established paper, ink, serif and mono typography.
- Add two semantic bloc colour ramps in the global design tokens: a deep Caribbean teal for CARICOM and sovereign gold for OECS, each with accessible pale-to-strong steps.
- Use gradients only inside quantitative bars and chart areas; no decorative gradient background.
- Direct-label every chart. Avoid pie charts, gauges, radar charts and a single opaque “strength score”.
- Animate bars and trend lines once when the drawer opens; respect reduced-motion settings.
- Keep chart geometry stable so changing the highlighted bloc does not shift the layout.

## Technical approach

- Add a protected bloc-summary server function that reads the cleaned public KPI records, applies membership and coverage rules, and returns ready-to-render totals, weighted values, medians, distributions and comparable history.
- Reuse the existing peer-statistics normalization and period logic so bloc summaries cannot disagree with the Sovereign Eye comparison.
- Add a focused `BlocEconomicSummary` component to the admin home country section, with small reusable paired-bar, bullet-row, trend and distribution components.
- Register the aggregation, weighting, coverage and meaningful-gap rationales in the existing Explain registry.
- Cache by bloc, data version and comparison year; refresh after the existing monthly peer-analysis run.
- Do not add a new database table initially. The current cleaned KPI dataset has usable records across all 22 country instances, but the UI will calculate and display per-indicator coverage rather than assuming completeness.

## Validation

- Verify CARICOM and OECS membership counts against the registry, including overlapping members and associates.
- Unit-test totals, weighted averages, medians, missing-data coverage, projections, mixed years and zero/negative values.
- Confirm keyboard and pointer behavior for the split controls and all chart marks.
- Check desktop, tablet and mobile layouts, longest labels, reduced motion and colour contrast.
- Confirm that selecting a bloc still filters the country grid independently of opening the summary drawer.
