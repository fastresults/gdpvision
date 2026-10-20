import { auth, defineMcp } from "@lovable.dev/mcp-js";

import compareCountries from "./tools/compare-countries";
import getCountryIndices from "./tools/get-country-indices";
import getIndexCatalogue from "./tools/get-index-catalogue";
import getKpis from "./tools/get-kpis";
import getSources from "./tools/get-sources";
import listEvents from "./tools/list-events";
import listMediaSignals from "./tools/list-media-signals";
import listCountries from "./tools/list-countries";
import searchSecondBrain from "./tools/search-second-brain";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "eyeframe-showcase",
  title: "EyeFrame Showcase",
  version: "0.1.0",
  instructions:
    "Read-only access to GDPVision public country data: countries, public economic indicators with sources, cross-country comparisons, verified public Second Brain facts and official source registers, recent media scan signals, and the Caribbean Indices (method and published edition scores with cited inputs), and published GDP Events. Answers act as the signed-in GDPVision user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCountries,
    getKpis,
    compareCountries,
    searchSecondBrain,
    getSources,
    listMediaSignals,
    getIndexCatalogue,
    getCountryIndices,
    listEvents,
  ],
});
