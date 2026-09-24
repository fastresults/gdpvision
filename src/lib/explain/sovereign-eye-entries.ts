// @domain explain
// @tables none
// @ui src/components/sovereign-eye/SovereignEyeWorkspace.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const ENTRIES: Array<Rationale<never>> = [
  {
    key: "sovereign-eye.globe-hazards",
    title: "How the globe's hazard layers are sourced",
    short: "Hurricanes come from NOAA's National Hurricane Center and earthquakes (M4.5+, past 7 days) from USGS, both U.S. public domain.",
    basis:
      "Feeds are fetched server-side, cached briefly (5 minutes for storms, 15 for earthquakes), and shown with distance from the selected country. Storm markers show the current centre from the latest advisory; ring size for earthquakes reflects magnitude only.",
    caveat:
      "Live context, not corpus evidence. GDPVision does not forecast storm tracks — use the official NHC cone. A feed that fails is marked unavailable rather than hidden.",
  },
  {
    key: "sovereign-eye.layer-strength",
    title: "How layer strength is derived",
    short: "The score blends available rows, confidence grades and freshness into a directional readiness signal.",
    basis:
      "Each layer is read from committed country corpus tables. KPI and source layers rise with the number of usable records; sector and capital-flow layers also weight the confidence grades attached to their rows. It is a readiness signal for reading the map, not a statistical probability.",
    caveat:
      "A high score can still hide a narrow evidence base, and a low score may simply mean the relevant onboarding stage has not been committed yet.",
  },
  {
    key: "sovereign-eye.live-feeds",
    title: "How live conditions are added",
    short: "The live layer uses no-key public feeds for weather and seismic context around the selected country.",
    basis:
      "The weather reading is taken from the country's approximate coordinate through a public weather feed. The seismic count is filtered to nearby events above magnitude 2.5 from the past seven days. These feeds are kept separate from the evidence corpus so they cannot overwrite country records.",
    caveat:
      "Live feeds are operational context only. They should not be treated as audited national data, and they can be unavailable if the public source is offline.",
  },
  {
    key: "sovereign-eye.ai-brief",
    title: "How the AI briefing is constrained",
    short: "The briefing is limited to the currently selected layers and must identify gaps instead of inventing them.",
    basis:
      "The request sends the chosen layer summaries, KPI values, sector shares, capital flows and live feed summaries to the AI model. The instruction forbids internal platform references and asks for a Cabinet-ready structure grounded only in that payload.",
    caveat:
      "The result is an analytical readout, not a new source of truth. Use the evidence panel to inspect the public/private corpus rows behind the map before acting on it.",
  },
  {
    key: "sovereign-eye.interpretation",
    title: "How this map interpretation is formed",
    short: "Trend and forecast language appears only when comparable observations or an explicit scenario support it.",
    basis:
      "Current readings come from the displayed record. A trend requires at least two comparable observations for the same indicator or flow. Forecasts require a named scenario with a stated horizon and uncertainty range.",
    caveat:
      "A visual size, line width, evidence count or single observation is not a time trend. Where the required history or scenario is absent, the map says so rather than inferring a direction.",
  },
  {
    key: "sovereign-eye.flow-partners",
    title: "How partner geography is sourced",
    short: "Global flow arcs are drawn only from cited bilateral partner records, never from invented locations.",
    basis:
      "A dedicated research pass asks for the top origin countries (inflows) or destination countries (outflows) per capital-flow node, with an approximate share and a citation for every row. Coordinates come from a fixed reference table of country centroids. Shares and values below the strongest confidence grade are drawn dashed.",
    caveat:
      "Partner shares are model estimates from cited bilateral sources (IMF CDIS/CPIS, UN Comtrade, central bank bulletins), not official bilateral statistics. A missing arc means no cited partner was found — it does not mean no flow exists.",
  },
];

registerRationales(ENTRIES);