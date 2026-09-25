// @domain standards
// @tables countries,standards_audit_snapshots
// @ui src/routes/_authenticated/admin/countries.$code.standards.tsx
//
// Monthly standards-audit snapshots. Called by the cadence-daily hook when a
// monthly window closes, and by snapshotNow for a single country. Must be
// given the service-role client: snapshots are written for every country and
// authenticated users have no INSERT on standards_audit_snapshots.

import { db } from "@/lib/syndication/db";

import {
  computeCountryAudit,
  loadLibrary,
  snapshotRecord,
  type Library,
  type TypedClient,
} from "./audit-data.server";

export type SnapshotResult = {
  period: string;
  countries: number;
  written: number;
  failed: Array<{ code: string; error: string }>;
};

/** Computes and upserts one country's snapshot for the period. */
export async function snapshotCountry(
  admin: TypedClient,
  code: string,
  periodLabel: string,
  library?: Library,
): Promise<{ coveragePct: number; weightedPct: number }> {
  const audit = await computeCountryAudit(admin, code, { library });
  const { error } = await db(admin)
    .from("standards_audit_snapshots")
    .upsert(snapshotRecord(code, periodLabel, audit), { onConflict: "country_code,period_label" });
  if (error) throw new Error(error.message);
  return { coveragePct: audit.summary.coveragePct, weightedPct: audit.summary.weightedPct };
}

/** Snapshots every country in the countries table for the period ("YYYY-MM"). */
export async function snapshotStandardsAudits(
  admin: TypedClient,
  periodLabel: string,
): Promise<SnapshotResult> {
  const { data, error } = await admin.from("countries").select("code").order("code");
  if (error) throw new Error(error.message);
  const codes = (data ?? []).map((c) => c.code);
  const library = await loadLibrary(admin);
  const result: SnapshotResult = {
    period: periodLabel,
    countries: codes.length,
    written: 0,
    failed: [],
  };
  if (library.requirements.length === 0) return result;
  // Sequential: a handful of countries, and it keeps the database load flat.
  for (const code of codes) {
    try {
      await snapshotCountry(admin, code, periodLabel, library);
      result.written++;
    } catch (e) {
      result.failed.push({ code, error: (e as Error).message });
    }
  }
  return result;
}
