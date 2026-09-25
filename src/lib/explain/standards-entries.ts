// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.standards.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<never>> = [
  {
    key: "standards.coverage",
    title: "How standard coverage is scored",
    short: "Share of a standard's requirements with current, complete evidence in the national ledger.",
    formula:
      "Collected = every mapped indicator present and fresh within the required lag. Partial = some indicators present, or a monthly/quarterly requirement only met by annual data. Stale = latest reading older than the allowed lag. Missing = no evidence.",
    basis: "Requirements come from the curated standards library (IMF e-GDDS/SDDS, GFSM 2014, BPM6, SNA, SDG, SPI, FATF, PEFA). Items without indicators count as collected only with an approved collection protocol.",
    caveat: "Annual ledger data cannot prove monthly or quarterly dissemination, so those items stay partial until a protocol is approved.",
  },
  {
    key: "investments.readiness",
    title: "How investment readiness is scored",
    short: "Number of investor-grade checks passed out of ten.",
    formula: "Each check maps to a named standard (OC4IDS, World Bank PPP Framework, FATF, IFC Performance Standards, ISSB/EU Taxonomy, GI Hub). All ten must pass before a project can be approved for syndication.",
    basis: "Checks read only the fields entered for the project; no values are inferred.",
    caveat: "Passing the checklist is not an investment recommendation; it confirms the package is complete enough for investor due diligence.",
  },
];

registerRationales(entries);
