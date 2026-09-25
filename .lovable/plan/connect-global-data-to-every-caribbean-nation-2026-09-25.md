# Connect global data to every Caribbean nation

## What the audit found

1. **Partner arcs exist for only 1 of 22 countries.** Partner research has run only for Grenada. The other 21 countries show no arcs, even though they all have capital-flow data.
2. **Hurricanes and earthquakes are shown, not connected.** The feeds (NOAA, USGS) are drawn on the globe with a distance to the selected island only. Nothing says which Caribbean nations a storm or quake threatens. There's no exposure radius, no comparison across the region, and no link to a country's economy (tourism, agriculture, capital flows).
3. **Nothing is region-wide.** The globe is always centred on one island. There's no "whole Caribbean" view that shows all 22 nations with their partners and hazards together.
4. **gods-eye-view as a source.** Its useful public sources are already in use (NOAA, USGS). Its other feeds are either not allowed for commercial use (OpenSky flights, TeleGeography cables) or depend on its heavy 3D tool. What's left to take from it is the approach: link each live event to the places it affects. We don't copy its code or its restricted data.

## Recommended approach

### Step 1: Research partners for all Caribbean countries
- A backfill job runs the existing partner research for the 21 missing countries, a few per run, using the same lock and pause-on-credits safeguards as the peer analysis.
- It's added to the monthly cron on the 1st, so partners are refreshed along with peer gaps.
- The admin sees progress on a "Partner coverage: N of 22" status line.

### Step 2: Link hazards to nations
- For every storm and quake, work out which of the 22 nations fall inside an exposure radius. For storms this is based on wind strength; for quakes, on magnitude and depth. Each nation is graded Direct, Near or Watch.
- The hover panel for a hazard lists the nations exposed, with distances. For each exposed nation it shows the economic context we already hold (tourism or agriculture share of the economy, main capital flows), labelled as context, not a forecast of damage.
- A country's panel gets an "Active hazards nearby" line.

### Step 3: Add a Caribbean region globe
- A new "Region" option on the Global view page centres the globe on the whole basin.
- Every nation is marked; nations exposed to hazards get a ring in the signal colour.
- Arcs can be shown for all countries, or filtered to one.
- A table under the globe lists nations by hazard exposure and partner count.

### Step 4 (optional, later): Extra open datasets
Only data that allows commercial use: NASA FIRMS fires, GDACS disaster alerts, NOAA forecast cones (these finish the storm cone item still to do). Flights, ships and cables stay out until a licensed source is chosen.

## Technical details
- Tables `country_capital_flow_partners` (1 country today) and `peer_analysis_runs` hold backfill state in a new `partner_backfill` run row; the existing lease pattern is reused.
- `global-feeds.server.ts`: add `exposureFor(event, countries[])` using country centroids from the `countries` table (add lat/lon columns if missing), with radius rules in pure `hazard-exposure.ts`.
- `getGlobalHazards` returns `exposed: {iso3, distanceKm, grade}[]` per event; `GlobeView` gets a `mode: "country" | "region"`.
- The Explain rationale `sovereign-eye.hazard-exposure` sets out radius rules and notes that exposure is not a damage estimate.
- Live hazard data stays out of the corpus as evidence. Public scenes keep only public partner rows.
