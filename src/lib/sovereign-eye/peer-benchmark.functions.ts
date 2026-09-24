// @domain sovereign-eye
// @tables peer_analysis_runs
// @ui src/components/sovereign-eye/SovereignEyeWorkspace.tsx
import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/lib/auth/require-admin";

export const refreshPeerAnalysis = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { runPeerAnalysis } = await import("./peer-analysis.server");
    return runPeerAnalysis({ force: true });
  });

export const getPeerAnalysisStatus = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("peer_analysis_runs").select("status,pause_reason,last_finished_at,last_summary").eq("name", "regional").maybeSingle();
    return data ? { ...data, last_summary: data.last_summary as Record<string, number | string> } : null;
  });
