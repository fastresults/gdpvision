// @domain mandate-compact
// @tables mandate_compacts,compact_pillars,compact_pledges,compact_deliverables,compact_scorecards,compact_runs,country_manifestos
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Step states for the 8-step stepper, derived from real rows,
// plus the latest AI run per step (running / stalled / failed / succeeded).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const STALL_MS = 3 * 60 * 1000;

export type StepState = "done" | "running" | "ready" | "blocked" | "stale" | "failed";
export type RunInfo = {
  id: string;
  step: "decompose" | "transform";
  status: "queued" | "running" | "succeeded" | "failed" | "stalled";
  stage: string | null;
  stage_detail: string | null;
  started_at: string;
  heartbeat_at: string;
  finished_at: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
};
export type CompactProgress = {
  steps: Record<string, { state: StepState; reason: string }>;
  runs: Partial<Record<"decompose" | "transform", RunInfo>>;
  counts: { pillars: number; pledges: number; deliverables: number; scorecards: number };
  active: boolean;
};

export const getCompactProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ compactId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<CompactProgress> => {
    const sb = context.supabase as any;
    const id = data.compactId;
    const cnt = async (t: string) => {
      const { count } = await sb.from(t).select("id", { count: "exact", head: true }).eq("compact_id", id);
      return count ?? 0;
    };
    const [compactRes, pillars, pledges, deliverables, scorecards, runsRes] = await Promise.all([
      sb.from("mandate_compacts").select("status, manifesto_id, updated_at").eq("id", id).maybeSingle(),
      cnt("compact_pillars"),
      cnt("compact_pledges"),
      cnt("compact_deliverables"),
      cnt("compact_scorecards"),
      sb.from("compact_runs").select("*").eq("compact_id", id).order("started_at", { ascending: false }).limit(20),
    ]);
    const compact = compactRes.data;

    const now = Date.now();
    const runs: CompactProgress["runs"] = {};
    for (const r of (runsRes.data ?? []) as RunInfo[]) {
      if (runs[r.step]) continue;
      const stalled = r.status === "running" && now - new Date(r.heartbeat_at).getTime() > STALL_MS;
      runs[r.step] = stalled
        ? { ...r, status: "stalled", error: r.error ?? "No progress for over 3 minutes. The connection was probably lost; retry the step." }
        : r;
    }

    // Is the manifesto newer than the last successful decompose?
    let manifestoAt: number | null = null;
    if (compact?.manifesto_id) {
      const { data: m } = await sb.from("country_manifestos").select("updated_at").eq("id", compact.manifesto_id).maybeSingle();
      if (m?.updated_at) manifestoAt = new Date(m.updated_at).getTime();
    }
    const lastOk = async (step: string) => {
      const { data: r } = await sb
        .from("compact_runs").select("finished_at").eq("compact_id", id).eq("step", step).eq("status", "succeeded")
        .order("finished_at", { ascending: false }).limit(1).maybeSingle();
      return r?.finished_at ? new Date(r.finished_at).getTime() : null;
    };
    const [decOk, trOk] = await Promise.all([lastOk("decompose"), lastOk("transform")]);

    const aiState = (step: "decompose" | "transform", hasOutput: boolean, prereq: boolean, prereqReason: string, staleReason: string | null) => {
      const r = runs[step];
      if (r?.status === "running") return { state: "running" as const, reason: r.stage ?? "Running" };
      if (!prereq) return { state: "blocked" as const, reason: prereqReason };
      if (r && (r.status === "failed" || r.status === "stalled")) return { state: "failed" as const, reason: r.error ?? "Last run failed" };
      if (hasOutput && staleReason) return { state: "stale" as const, reason: staleReason };
      if (hasOutput) return { state: "done" as const, reason: "Complete" };
      return { state: "ready" as const, reason: "Ready to run" };
    };

    const hasCompact = !!compact;
    const status = compact?.status ?? "draft";
    const steps: CompactProgress["steps"] = {
      ingest: hasCompact ? { state: "done", reason: "Manifesto on file" } : { state: "ready", reason: "Upload or link a manifesto" },
      decompose: aiState(
        "decompose", pillars > 0, hasCompact, "Ingest a manifesto first",
        manifestoAt && decOk && manifestoAt > decOk ? "A newer manifesto arrived since the last decompose" : null,
      ),
      transform: aiState(
        "transform", deliverables > 0, pledges > 0, "Run Decompose first",
        decOk && trOk && decOk > trOk ? "Pledges changed since the last transform" : null,
      ),
      track: deliverables === 0
        ? { state: "blocked", reason: "Run Transform first" }
        : scorecards > 0 ? { state: "done", reason: "Scorecards recorded" } : { state: "ready", reason: "Record quarterly status" },
      ministries: deliverables === 0 ? { state: "blocked", reason: "Run Transform first" } : { state: "done", reason: "Owners assigned" },
      publish: !hasCompact
        ? { state: "blocked", reason: "Ingest a manifesto first" }
        : status === "draft" ? { state: "ready", reason: "Awaiting signature" } : { state: "done", reason: status.replace("_", " ") },
      plan: deliverables === 0 ? { state: "blocked", reason: "Run Transform first" } : { state: "ready", reason: "Generate the cabinet plan" },
      history: hasCompact ? { state: "done", reason: "Audit trail available" } : { state: "blocked", reason: "Nothing recorded yet" },
    };

    return {
      steps,
      runs,
      counts: { pillars, pledges, deliverables, scorecards },
      active: Object.values(runs).some((r) => r?.status === "running"),
    };
  });
