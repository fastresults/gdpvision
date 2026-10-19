// @domain indices
// @tables index_source_snapshots
// @ui none
//
// Last captured copy of every API series (World Bank WDI, IMF WEO), per country.
// Every successful fetch refreshes it. When a live source still fails after its
// retries, the runner uses the snapshot instead — only if it was captured within
// SNAPSHOT_MAX_AGE_DAYS — and the input is tagged origin = 'snapshot' with the
// capture date, and source_ok = false so the Sextant's source-health part drops.
// The method's age tolerance still applies to the year each value refers to.

import type { SourceResult } from "./sources.server";
import { db, type AnyClient } from "@/lib/syndication/db";

export const SNAPSHOT_MAX_AGE_DAYS = 30;
const SNAPSHOT_KINDS = new Set(["wdi", "imf_weo"]);

export const snapshotable = (kind: string, code: string | null): code is string =>
  SNAPSHOT_KINDS.has(kind) && Boolean(code);

/** Upsert the series' per-country observations. Errors are reported, never thrown. */
export async function saveSnapshot(
  sb: AnyClient,
  kind: string,
  code: string,
  result: SourceResult,
  runId: string,
): Promise<string | null> {
  if (!result.ok || !result.byCountry.size) return null;
  const now = new Date().toISOString();
  const rows = [...result.byCountry.entries()].map(([country_code, v]) => ({
    source_kind: kind,
    source_code: code,
    country_code,
    observations: v.observations,
    grade: v.grade,
    source_url: v.source_url,
    source_org: v.source_org,
    retrieved_at: now,
    run_id: runId,
  }));
  const { error } = await db(sb)
    .from("index_source_snapshots")
    .upsert(rows, { onConflict: "source_kind,source_code,country_code" });
  return error ? error.message : null;
}

/**
 * The last captured copy of a series, if every country's copy is recent enough.
 * Countries whose copy is older than the limit are left out (not scored from stale captures).
 */
export async function loadSnapshot(
  sb: AnyClient,
  kind: string,
  code: string,
  maxAgeDays = SNAPSHOT_MAX_AGE_DAYS,
): Promise<{ byCountry: SourceResult["byCountry"]; oldest: string | null } | null> {
  const since = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();
  const { data, error } = await db(sb)
    .from("index_source_snapshots")
    .select("country_code,observations,grade,source_url,source_org,retrieved_at")
    .eq("source_kind", kind)
    .eq("source_code", code)
    .gte("retrieved_at", since);
  if (error || !data?.length) return null;
  const byCountry: SourceResult["byCountry"] = new Map();
  let oldest: string | null = null;
  for (const r of data as Array<{
    country_code: string;
    observations: Array<{ period: string; value: number | null }>;
    grade: "A" | "B" | "C" | "D" | null;
    source_url: string | null;
    source_org: string | null;
    retrieved_at: string;
  }>) {
    const observations = (r.observations ?? [])
      .map((o) => ({ period: String(o.period), value: o.value == null ? NaN : Number(o.value) }))
      .filter((o) => Number.isFinite(o.value)); // a stored null never becomes 0
    if (!observations.length) continue;
    byCountry.set(r.country_code, {
      observations,
      grade: r.grade,
      source_url: r.source_url,
      source_org: r.source_org,
      retrieved_at: r.retrieved_at,
    });
    if (!oldest || r.retrieved_at < oldest) oldest = r.retrieved_at;
  }
  return { byCountry, oldest };
}
