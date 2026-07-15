// Ledger-QA self-healing loop types. See .lovable/plan.md.

export type FindingClass =
  | "data-missing"
  | "data-quality"
  | "code-defect"
  | "external-outage"
  | "config"
  | "not-run";

export type SystemicFixKind =
  | "operator-action"
  | "auto-migration"
  | "writer-patch"
  | "retry"
  | "none";

export type Finding = {
  checkKey: string;
  severity: "warn" | "fail" | "info";
  rootCause: string;
  class: FindingClass;
  evidence: Array<{ label: string; value: string | number }>;
  affectedRows?: number;
  systemicFix: {
    kind: SystemicFixKind;
    description: string;
    /** Deep link target for operator-action / writer-patch */
    href?: string;
    /** File + line for writer-patch */
    upstreamFile?: string;
    /** SQL preview for auto-migration */
    previewSql?: string;
    /** Whether the remediator can auto-run (super-admin only) */
    canAutoApply: boolean;
    /** Registry key the UI dispatches to the remediator */
    remediatorKey?:
      | "repairInvalidSourceUrls"
      | "retryUnreachableSources"
      | "backfillCapitalFlows"
      | "backfillSectors"
      | "backfillMinistryProfiles"
      | "backfillKpiSeries"
      | "redriveCorpusMisses"
      | "cascadeFix"
      | "aiDiagnose";
    /** Corpus domain for the "last attempt" panel */
    corpusDomain?: string;
    /** Upstream check keys blocked (used by gate/cascadeFix) */
    cascadeKeys?: string[];
  };
};

