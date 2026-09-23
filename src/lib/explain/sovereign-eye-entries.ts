// @domain explain
// @tables none
// @ui src/components/sovereign-eye/SovereignEyeWorkspace.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const ENTRIES: Array<Rationale<never>> = [
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
];

registerRationales(ENTRIES);