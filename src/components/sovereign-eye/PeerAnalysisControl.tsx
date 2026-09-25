import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";

import { getPeerAnalysisStatus, refreshPeerAnalysis } from "@/lib/sovereign-eye/peer-benchmark.functions";

export function PeerAnalysisControl({ code }: { code: string }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getPeerAnalysisStatus);
  const refreshFn = useServerFn(refreshPeerAnalysis);
  const status = useQuery({ queryKey: ["peer-analysis-status"], queryFn: () => statusFn(), retry: false });
  const run = useMutation({
    mutationFn: () => refreshFn(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["peer-analysis-status"] });
      qc.invalidateQueries({ queryKey: ["sovereign-eye", code, "workspace"] });
    },
  });
  const s = status.data;
  const summary = s?.last_summary ?? {};
  const label = s?.status === "paused"
    ? `Paused: ${s.pause_reason ?? "AI unavailable"}`
    : s?.last_finished_at
      ? `Peer analysis ${new Date(s.last_finished_at).toLocaleDateString()} · ${summary.meaningful ?? 0} meaningful gaps · ${summary.remaining ?? 0} explanations pending`
      : "Peer analysis not run yet";
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-ink-500">{run.isPending ? "Running regional analysis…" : label}</span>
      <button type="button" className="btn-secondary min-h-9 px-3 font-mono text-[10px] uppercase tracking-[0.16em]" disabled={run.isPending} onClick={() => run.mutate()}>
        <RefreshCw size={12} aria-hidden className={run.isPending ? "animate-spin" : ""} /> Refresh peer analysis
      </button>
    </div>
  );
}
