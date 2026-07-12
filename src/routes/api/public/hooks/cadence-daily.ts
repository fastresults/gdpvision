// Cadence daily cron hook (PRD Wave E1).
// Called by pg_cron; closes any monthly/quarterly/annual/term windows that
// have just ended. Idempotent: cadence_closes has a UNIQUE (window_kind,
// period_label) constraint.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type WindowKind = "monthly" | "quarterly" | "annual" | "term";

function periodLabelFor(kind: WindowKind, at: Date): string {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth() + 1;
  switch (kind) {
    case "monthly": return `${y}-${String(m).padStart(2, "0")}`;
    case "quarterly": return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "annual": return `${y}`;
    case "term": return `${y - (y % 4)}-T`;
  }
}

// Yesterday, at UTC — if yesterday's day belongs to a period whose next day
// starts a new period, close it.
function windowsToClose(now: Date): Array<{ kind: WindowKind; period: string }> {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const yesterday = new Date(Date.UTC(y, m, d - 1));
  const out: Array<{ kind: WindowKind; period: string }> = [];
  // Monthly: today is day 1 → close previous month.
  if (d === 1) out.push({ kind: "monthly", period: periodLabelFor("monthly", yesterday) });
  // Quarterly: today is Jan/Apr/Jul/Oct day 1.
  if (d === 1 && [0, 3, 6, 9].includes(m)) out.push({ kind: "quarterly", period: periodLabelFor("quarterly", yesterday) });
  // Annual: today is Jan 1.
  if (d === 1 && m === 0) out.push({ kind: "annual", period: periodLabelFor("annual", yesterday) });
  // Term: today is Jan 1 of a year divisible by 4.
  if (d === 1 && m === 0 && y % 4 === 0) out.push({ kind: "term", period: periodLabelFor("term", yesterday) });
  return out;
}

export const Route = createFileRoute("/api/public/hooks/cadence-daily")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = new Date();
        const windows = windowsToClose(now);
        if (windows.length === 0) {
          return Response.json({ ok: true, closed: [], skipped: "no window ends today" });
        }

        const { data: kpis, error: kErr } = await supabase.from("kpis").select("id,baseline,target");
        if (kErr) return Response.json({ ok: false, error: kErr.message }, { status: 500 });

        const closed: Array<{ kind: WindowKind; period: string; snapshots: number }> = [];
        for (const w of windows) {
          const { data: existing } = await supabase
            .from("cadence_closes")
            .select("id")
            .eq("window_kind", w.kind)
            .eq("period_label", w.period)
            .maybeSingle();
          if (existing) continue;

          const snapshots = (kpis ?? []).map((k) => {
            const value = k.baseline as number | null;
            const target = k.target as number | null;
            const variance =
              value !== null && target !== null && target !== 0
                ? Number((((value - target) / target) * 100).toFixed(2))
                : null;
            return {
              kpi_id: k.id,
              window_kind: w.kind,
              period_label: w.period,
              value,
              target,
              variance_pct: variance,
            };
          });
          if (snapshots.length > 0) {
            await supabase.from("kpi_snapshots").insert(snapshots);
          }
          await supabase.from("cadence_closes").insert({
            window_kind: w.kind,
            period_label: w.period,
            snapshot_count: snapshots.length,
            notes: "cron",
          });
          closed.push({ kind: w.kind, period: w.period, snapshots: snapshots.length });
        }

        return Response.json({ ok: true, closed });
      },
    },
  },
});
