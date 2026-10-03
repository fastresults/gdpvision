// Shared corpus gateway types (safe to import from client OR server).

export type CorpusDomain =
  | "sources"
  | "memory"
  | "kpi"
  | "sector"
  | "ministry"
  | "dossier"
  | "flow"
  | "citation"
  /** Ideal Minister Profiles (chamber 07, Ministers track). Read-only; see searchers/portfolio-persona.server.ts. */
  | "portfolio_persona";

export type CorpusCitation = {
  url: string;
  title?: string;
  org?: string | null;
};

export type CorpusOutcome = "hit" | "external" | "empty" | "throttled" | "error";

export type CorpusReadResult<T> = {
  data: T;
  source: "corpus" | "external" | "empty";
  outcome: CorpusOutcome;
  tier?: string;
  citations?: CorpusCitation[];
  provenance?: {
    domain: CorpusDomain;
    key: string;
    country_code: string;
    latency_ms: number;
    tier?: string;
    notes?: string[];
  };
};
