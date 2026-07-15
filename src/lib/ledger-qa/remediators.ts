// Ledger-QA remediator registry.
// Keyed by (checkKey, findingClass) → dispatch metadata.
// The UI reads this to render a single "Fix" button per drawer instead of
// hard-coding switch cases.

export type RemediatorKey =
  | "repairInvalidSourceUrls"
  | "retryUnreachableSources"
  | "backfillCapitalFlows"
  | "backfillSectors"
  | "backfillMinistryProfiles"
  | "backfillKpiSeries"
  | "redriveCorpusMisses"
  | "cascadeFix"
  | "aiDiagnose";

export type RemediatorEntry = {
  key: RemediatorKey;
  label: string;
  /** sync-await blocks the UI (with a spinner); background just fires. */
  mode: "sync-await" | "background";
  description: string;
  /** Corpus domain this remediator populates — for the "last attempt" panel. */
  corpusDomain?: string;
  /** True when the remediator can auto-run without human input. */
  canAutoApply: boolean;
};

const R = (e: RemediatorEntry) => e;

export const REMEDIATOR_TABLE: Record<string, RemediatorEntry> = {
  "sources|data-quality": R({
    key: "repairInvalidSourceUrls",
    label: "Apply repair",
    mode: "sync-await",
    description: "Quarantine non-URL rows (set active=false, fetch_status='invalid_url').",
    canAutoApply: true,
  }),
  "sources|external-outage": R({
    key: "retryUnreachableSources",
    label: "Retry HEAD checks",
    mode: "sync-await",
    description: "Re-run HEAD checks with an 8s timeout; refresh source_health_checks.",
    canAutoApply: true,
  }),
  "enrichment|data-missing": R({
    key: "backfillCapitalFlows",
    label: "Backfill capital flows",
    mode: "sync-await",
    description: "Run Perplexity → Gemini waterfall for the capital-flow node registry and commit fresh rows.",
    corpusDomain: "flow",
    canAutoApply: true,
  }),
  "trust|data-missing": R({
    key: "backfillKpiSeries",
    label: "Backfill missing KPIs",
    mode: "sync-await",
    description: "Fetch the top missing required KPIs from World Bank / IMF / Perplexity and commit.",
    corpusDomain: "kpi",
    canAutoApply: true,
  }),
  "overview|data-missing": R({
    key: "backfillSectors",
    label: "Backfill sector composition",
    mode: "sync-await",
    description: "Fetch GDP composition and replace country_sectors rows via replace_country_sectors RPC.",
    corpusDomain: "sector",
    canAutoApply: true,
  }),
  "overview|data-quality": R({
    key: "backfillMinistryProfiles",
    label: "Backfill ministry profiles",
    mode: "sync-await",
    description: "Fill any ministry lacking a profile by researching the current Minister + mandate.",
    corpusDomain: "ministry",
    canAutoApply: true,
  }),
  "gate|config": R({
    key: "cascadeFix",
    label: "Fix upstream cascade",
    mode: "sync-await",
    description: "Run each blocked upstream remediator in order, then re-check the publish gate.",
    canAutoApply: true,
  }),
  "corpus-miss|data-missing": R({
    key: "redriveCorpusMisses",
    label: "Redrive corpus misses",
    mode: "sync-await",
    description: "Clear cooldown on stuck (domain,key) pairs so the next natural read re-attempts search.",
    canAutoApply: true,
  }),
};

// Cascade map — for publish-gate check keys, run these remediators in order.
export const CASCADE_MAP: Record<string, RemediatorKey[]> = {
  shares: ["backfillSectors"],
  coverage: ["backfillMinistryProfiles"],
  freshness: ["backfillKpiSeries"],
  sources: ["repairInvalidSourceUrls", "retryUnreachableSources"],
  // "alerts" has no auto-remediator — operator must acknowledge.
};

export function lookupRemediator(checkKey: string, findingClass: string): RemediatorEntry | null {
  return REMEDIATOR_TABLE[`${checkKey}|${findingClass}`] ?? null;
}
