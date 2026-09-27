// @domain explain
// @tables none
// @ui src/components/mandate-compact/RunProgress.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<Record<string, never>>> = [
  {
    key: "compact.step-state",
    title: "How each step's status is worked out",
    short: "Step badges come from real records, not from which step you clicked.",
    formula:
      "Ingest: compact exists. Decompose: pillars exist. Transform: deliverables exist. Track: scorecards exist. Publish: compact signed or later. Out of date: the input changed after the last successful run.",
    basis: "Counts of pillars, pledges, deliverables and scorecards, the compact's status and the run log.",
    caveat: "Blocked means an earlier step has no output yet; it is not an error.",
    derive: () => [],
  },
  {
    key: "compact.run-stall",
    title: "When an AI run counts as stalled",
    short: "A run that sends no progress signal for 3 minutes is marked stalled.",
    formula: "Stalled = status running AND now − last heartbeat > 3 minutes. Runs send a heartbeat every 15 seconds.",
    basis: "The compact_runs log written by Decompose and Transform.",
    caveat: "Usually caused by a lost connection or a timed-out AI call. Retrying is safe: each step rebuilds its output rather than adding duplicates.",
    derive: () => [],
  },
];

registerRationales(entries as never);
