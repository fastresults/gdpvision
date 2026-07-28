// @domain executive
// @tables none
// @ui src/components/executive/AttentionRail.tsx
//
// Deterministic ranking of what needs the Principal. No AI call — the rail
// must paint instantly, and executives distrust black boxes, so every item
// carries the arithmetic that put it there.

import type { ChamberAlert, ChamberSummary } from "./types";

export interface AttentionItem extends ChamberAlert {
  rank: number;
  chamberTitle: string;
  to: ChamberSummary["to"];
}

export function rankAttention(chambers: ChamberSummary[], limit = 5): AttentionItem[] {
  const byIndex = new Map(chambers.map((c) => [c.index, c]));
  return chambers
    .flatMap((c) => c.alerts)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, limit)
    .map((a, i) => {
      const c = byIndex.get(a.chamber);
      return {
        ...a,
        rank: i + 1,
        chamberTitle: c?.title ?? `Chamber ${a.chamber}`,
        to: c?.to ?? "/admin/countries/$code/ledger",
      };
    });
}
