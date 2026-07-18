import { useState } from "react";
import { Info } from "lucide-react";
import type { Allocation } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { cn } from "@/lib/utils";
import { ReadMore } from "./ReadMore";
import { ExplainHover } from "./ExplainHover";
import { EXPLAIN } from "./explain-copy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Sector = { code: string; label: string; hue_token?: string | null };

export function ExposureLedger({
  allocation,
  sectors,
  targets,
}: {
  allocation: Allocation;
  sectors: Sector[];
  targets: string[];
}) {
  const byCode = new Map(sectors.map((s, i) => [s.code, { s, i }]));
  const rows = [...allocation.entries].sort((a, b) => b.exposure_delta_pp - a.exposure_delta_pp);
  const [explainOpen, setExplainOpen] = useState(false);
  return (
    <div className="border border-line-200">
      <div className="flex items-baseline justify-between border-b border-line-200 px-4 py-3">
        <ExplainHover copy={EXPLAIN.exposure_ledger} side="left">
          <p className="cursor-help font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 underline decoration-dotted decoration-line-200 underline-offset-4">
            Exposure ledger
          </p>
        </ExplainHover>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] text-ink-500">what breaks</p>
          <button
            type="button"
            onClick={() => setExplainOpen(true)}
            aria-label="Explain exposure ledger"
            className="grid h-5 w-5 place-items-center rounded-full text-ink-500 hover:bg-paper-100 hover:text-ink-950"
          >
            <Info size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">How to read this exposure</DialogTitle>
            <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              A McKinsey-style briefing · ~120 words
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm leading-relaxed text-ink-800">
            <p>
              <span className="font-semibold text-ink-950">What this is.</span> A per-sector
              delta between today's FDI mix and the resilient mix the framed threat requires.
            </p>
            <p>
              <span className="font-semibold text-ink-950">How to read it.</span>{" "}
              <span className="font-mono text-[11px]">now %</span> is the baseline share,{" "}
              <span className="font-mono text-[11px]">new %</span> is the post-reallocation share,{" "}
              <span className="font-mono text-[11px]">Δ pp</span> is the shift in percentage points —
              red for contraction, green for growth. The red bar shows the magnitude of forced retreat.
            </p>
            <p>
              <span className="font-semibold text-ink-950">"Target" sectors</span> were flagged by the
              threat brief as directly exposed; they carry the burden of reallocation.
            </p>
            <p>
              <span className="font-semibold text-ink-950">What to do.</span> Stage actions in the
              timeline that de-risk targets (Δ negative) or absorb reallocated capital in
              beneficiaries (Δ positive).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExplainOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ul className="divide-y divide-line-200">
        {rows.map((r) => {
          const s = byCode.get(r.sector_code);
          const color = sectorColor(s?.s.hue_token, s?.i ?? 0);
          const isTarget = targets.includes(r.sector_code);
          const delta = r.resilient_pct - r.current_pct;
          return (
            <li key={r.sector_code} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 flex-none" style={{ background: color }} />
                <ReadMore
                  title={s?.s.label ?? r.sector_code}
                  text={s?.s.label ?? r.sector_code}
                  clamp={1}
                  className={cn("min-w-0 flex-1 text-sm", isTarget ? "text-ink-950" : "text-ink-700")}
                  markdown={false}
                />
                {isTarget && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-rose-600">
                    target
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] text-ink-500">
                <span>
                  now <span className="text-ink-950 tabular-nums">{r.current_pct.toFixed(1)}%</span>
                </span>
                <span>
                  new <span className="text-ink-950 tabular-nums">{r.resilient_pct.toFixed(1)}%</span>
                </span>
                <span>
                  Δ{" "}
                  <span
                    className={cn(
                      "tabular-nums",
                      delta > 0.05 ? "text-emerald-700" : delta < -0.05 ? "text-rose-600" : "text-ink-500",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)} pp
                  </span>
                </span>
              </div>
              {r.exposure_delta_pp > 0 && (
                <div className="mt-2 h-1.5 w-full bg-line-200">
                  <div
                    className="h-full bg-rose-500"
                    style={{
                      width: `${Math.min(100, (r.exposure_delta_pp / Math.max(1, r.current_pct)) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
