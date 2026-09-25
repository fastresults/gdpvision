// Partner-geography backfill: runs the cited partner research for Caribbean
// countries that have none (or stale data), a few per call, under a lease.
import { CARIBBEAN_POINTS } from "./caribbean-geo";

const RUN = "partner_backfill";
const LEASE_MIN = 10;
const STALE_DAYS = 30;

export async function researchAndStorePartners(countryCode: string) {
  const { searchCapitalFlowPartners } = await import("@/lib/corpus/searchers/flow-partners.server");
  const { upsertCapitalFlowPartner } = await import("@/lib/corpus/writers.server");
  const result = await searchCapitalFlowPartners({ countryCode });
  if (!result) return { written: 0, tier: null as string | null, message: "No cited partner geography found for this country yet." };
  let written = 0;
  for (const partner of result.data.partners) {
    const partnerCitations = partner.source_url ? result.citations.filter((c) => c.url === partner.source_url) : result.citations.slice(0, 3);
    await upsertCapitalFlowPartner({
      country_code: countryCode,
      node_key: partner.node_key,
      period: result.data.period,
      partner_name: partner.partner_name,
      partner_iso3: partner.partner_iso3 ?? null,
      share_pct: partner.share_pct ?? null,
      value_usd_m: partner.value_usd_m ?? null,
      confidence_grade: partner.confidence_grade ?? "C",
      visibility: "public",
      citations: partnerCitations.length ? partnerCitations : result.citations.slice(0, 3),
    });
    written += 1;
  }
  return { written, tier: result.tier as string | null, message: null as string | null };
}

export async function partnerCoverage() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [{ data: countries }, { data: rows }, { data: run }] = await Promise.all([
    db.from("countries").select("code"),
    db.from("country_capital_flow_partners").select("country_code,updated_at"),
    db.from("peer_analysis_runs").select("status,pause_reason,last_finished_at,last_summary").eq("name", RUN).maybeSingle(),
  ]);
  const latest = new Map<string, string>();
  for (const r of (rows ?? []) as Array<{ country_code: string; updated_at: string }>) {
    const prev = latest.get(r.country_code);
    if (!prev || r.updated_at > prev) latest.set(r.country_code, r.updated_at);
  }
  const codes = ((countries ?? []) as Array<{ code: string }>).map((c) => c.code).filter((c) => CARIBBEAN_POINTS.some((p) => p.code === c));
  const covered = codes.filter((c) => latest.has(c));
  const missing = codes.filter((c) => !latest.has(c));
  const stale = covered.filter((c) => Date.now() - new Date(latest.get(c)!).getTime() > STALE_DAYS * 86_400_000);
  return { total: codes.length, covered: covered.length, missing, stale, run: run ?? null };
}

export async function runPartnerBackfill(opts: { maxCountries?: number; force?: boolean } = {}) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  await db.from("peer_analysis_runs").upsert({ name: RUN }, { onConflict: "name", ignoreDuplicates: true });
  const { data: run } = await db.from("peer_analysis_runs").select("status,pause_reason").eq("name", RUN).maybeSingle();
  if (run?.status === "paused" && !opts.force) return { ok: false, skipped: "paused", reason: run.pause_reason, processed: [] as string[] };

  const { data: got } = await db
    .from("peer_analysis_runs")
    .update({ status: "running", lease_until: new Date(now.getTime() + LEASE_MIN * 60_000).toISOString(), last_started_at: now.toISOString(), pause_reason: null, updated_at: now.toISOString() })
    .eq("name", RUN)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("name");
  if (!got?.length) return { ok: false, skipped: "already running", processed: [] as string[] };

  const processed: string[] = [];
  const failed: Record<string, string> = {};
  let status = "idle";
  let pause: string | null = null;
  try {
    const cov = await partnerCoverage();
    const queue = [...cov.missing, ...cov.stale].slice(0, opts.maxCountries ?? 1);
    for (const code of queue) {
      try {
        await researchAndStorePartners(code);
        processed.push(code);
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        failed[code] = msg.slice(0, 200);
        if (/\b(402|403)\b/.test(msg)) { status = "paused"; pause = "AI credits or permission unavailable — top up and resume."; break; }
      }
    }
    const after = await partnerCoverage();
    const summary = { covered: after.covered, total: after.total, remaining: after.missing.length + after.stale.length, processed: processed.join(",") || "none", failed: Object.keys(failed).join(",") || "none" };
    await db.from("peer_analysis_runs").update({ status, pause_reason: pause, lease_until: null, last_finished_at: new Date().toISOString(), last_summary: summary, updated_at: new Date().toISOString() }).eq("name", RUN);
    return { ok: true, processed, failed, ...summary };
  } catch (e) {
    await db.from("peer_analysis_runs").update({ status: "idle", lease_until: null, pause_reason: String((e as Error)?.message ?? e).slice(0, 200), updated_at: new Date().toISOString() }).eq("name", RUN);
    throw e;
  }
}
