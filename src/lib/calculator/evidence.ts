import type { FactGrade } from "./facts.server";

export type EvidenceState = "record" | "reference" | "adjusted";

export interface EvidenceEntry {
  key: string;
  label: string;
  display: string;
  state: EvidenceState;
  grade: FactGrade;
  source: string;
  benchmark?: string | null;
  replacement: string;
}

export interface EvidenceCounts {
  record: number;
  reference: number;
  adjusted: number;
}

export function countEvidence(entries: EvidenceEntry[]): EvidenceCounts {
  return entries.reduce<EvidenceCounts>(
    (counts, entry) => ({ ...counts, [entry.state]: counts[entry.state] + 1 }),
    { record: 0, reference: 0, adjusted: 0 },
  );
}
