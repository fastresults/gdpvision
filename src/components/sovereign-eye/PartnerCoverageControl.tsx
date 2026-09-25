import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe2 } from "lucide-react";
import { useState } from "react";

import { getPartnerCoverage, stepPartnerBackfill } from "@/lib/sovereign-eye/partner-backfill.functions";

/** Admin control: shows partner-geography coverage and researches missing countries one at a time. */
export function PartnerCoverageControl({ code }: { code: string }) {
  const qc = useQueryClient();
  const coverageFn = useServerFn(getPartnerCoverage);
  const stepFn = useServerFn(stepPartnerBackfill);
  const cov = useQuery({ queryKey: ["partner-coverage"], queryFn: () => coverageFn(), retry: false });
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setNote(null);
    try {
      for (let i = 0; i < 25; i++) {
        const r = await stepFn();
        await qc.invalidateQueries({ queryKey: ["partner-coverage"] });
        if (!r.ok) { setNote(r.skipped === "already running" ? "Another run is in progress." : `Stopped: ${r.skipped ?? "error"}`); break; }
        if (!r.remaining) break;
      }
    } catch (e) { setNote((e as Error).message); }
    finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["sovereign-eye", code, "workspace"] });
    }
  };

  const c = cov.data;
  const remaining = c ? c.missing.length + c.stale.length : 0;
  const label = c ? (c.status === "paused" ? `Partners paused: ${c.pauseReason ?? "AI unavailable"}` : `Partner coverage: ${c.covered} of ${c.total}`) : "Partner coverage…";
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-ink-500">{running ? `Researching partners… ${label}` : note ?? label}</span>
      {remaining > 0 ? (
        <button type="button" className="btn-secondary min-h-9 px-3 font-mono text-[10px] uppercase tracking-[0.16em]" disabled={running} onClick={run}>
          <Globe2 size={12} aria-hidden className={running ? "animate-spin" : ""} /> Research {remaining} missing
        </button>
      ) : null}
    </div>
  );
}
