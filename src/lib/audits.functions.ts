// Universal country+sector keying audit (PRD DoD gate).
// Scans domain tables for missing/invalid country_code / sector_code
// references. Admin-only; results persist to public.keying_audits.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

interface TableProbe {
  table: string;
  countryField?: string;
  sectorField?: string;
}

// Tables the audit walks. Extend as new domain tables land.
const PROBES: TableProbe[] = [
  { table: "series", countryField: "country_code", sectorField: "sector_code" },
  { table: "kpis", countryField: "country_code", sectorField: "sector_code" },
  { table: "levers", countryField: "country_code", sectorField: "sector_code" },
  { table: "commitments", countryField: "country_code", sectorField: "sector_code" },
  { table: "scenarios", countryField: "country_code" },
  { table: "packages", countryField: "country_code", sectorField: "sector_code" },
  { table: "cabinet_sessions", countryField: "country_code" },
  { table: "mandates", countryField: "country_code" },
  { table: "goal_cycles", countryField: "country_code" },
  { table: "strategy_statements", countryField: "country_code", sectorField: "sector_code" },
  { table: "comms_artifacts", countryField: "country_code", sectorField: "sector_code" },
  { table: "intake_items", countryField: "country_code", sectorField: "sector_code" },
  { table: "memory_objects", countryField: "country_code", sectorField: "sector_code" },
  { table: "counsel_answers", countryField: "country_code" },
  { table: "ministries", countryField: "country_code" },
  { table: "country_sectors", countryField: "country_code", sectorField: "sector_code" },
  { table: "exposure_index", countryField: "country_code" },
  { table: "sources", countryField: "country_code" },
];

interface Violation {
  table: string;
  kind: "missing_country" | "missing_sector" | "invalid_country" | "invalid_sector";
  count: number;
}

interface AuditReport {
  totals: { checked: number; violations: number };
  perTable: Array<{ table: string; rows: number; violations: Violation[] }>;
  ranAt: string;
}

export const runKeyingAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load valid keys.
    const [{ data: countries }, { data: sectors }] = await Promise.all([
      supabaseAdmin.from("countries").select("code"),
      supabaseAdmin.from("sectors").select("code"),
    ]);
    const validCountries = new Set((countries ?? []).map((c) => c.code));
    const validSectors = new Set((sectors ?? []).map((s) => s.code));
    for (const s of CANONICAL_SECTORS) validSectors.add(s.slug);

    const perTable: AuditReport["perTable"] = [];
    let totalChecked = 0;
    let totalViolations = 0;

    for (const probe of PROBES) {
      const cols = ["id"].concat(probe.countryField ? [probe.countryField] : []).concat(probe.sectorField ? [probe.sectorField] : []);
      const { data, error } = await supabaseAdmin.from(probe.table as any).select(cols.join(","));
      if (error) {
        perTable.push({ table: probe.table, rows: 0, violations: [{ table: probe.table, kind: "missing_country", count: -1 }] });
        continue;
      }
      const rows = data ?? [];
      totalChecked += rows.length;
      const buckets = new Map<Violation["kind"], number>();
      for (const row of rows as any[]) {
        if (probe.countryField) {
          const v = row[probe.countryField];
          if (v == null || v === "") buckets.set("missing_country", (buckets.get("missing_country") ?? 0) + 1);
          else if (!validCountries.has(v)) buckets.set("invalid_country", (buckets.get("invalid_country") ?? 0) + 1);
        }
        if (probe.sectorField) {
          const v = row[probe.sectorField];
          if (v == null || v === "") buckets.set("missing_sector", (buckets.get("missing_sector") ?? 0) + 1);
          else if (!validSectors.has(v)) buckets.set("invalid_sector", (buckets.get("invalid_sector") ?? 0) + 1);
        }
      }
      const violations = Array.from(buckets.entries()).map(([kind, count]) => ({ table: probe.table, kind, count }));
      totalViolations += violations.reduce((a, v) => a + v.count, 0);
      perTable.push({ table: probe.table, rows: rows.length, violations });
    }

    const report: AuditReport = {
      totals: { checked: totalChecked, violations: totalViolations },
      perTable,
      ranAt: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("keying_audits")
      .insert({ ran_by: context.userId, total_checked: totalChecked, total_violations: totalViolations, report: report as any })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, report };
  });

export interface KeyingAuditRow {
  id: string;
  ran_at: string;
  total_checked: number;
  total_violations: number;
  report: AuditReport;
}

export const listKeyingAudits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KeyingAuditRow[]> => {
    const { data, error } = await context.supabase
      .from("keying_audits")
      .select("id,ran_at,total_checked,total_violations,report")
      .order("ran_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ ...r, report: r.report as AuditReport }));
  });
