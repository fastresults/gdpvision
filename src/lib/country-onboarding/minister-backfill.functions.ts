// Admin-only backfill: fill in ministry_profiles.minister and
// ministry_profiles.minister_profile for every existing country that already
// has ministries, using the 4-pass resolveMinister loop.
//
// Runs are persisted as long-running jobs in `minister_backfill_runs` +
// `minister_backfill_country_runs`, so the UI can poll for live progress and
// survive page refreshes / tab closes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  country_code: z.string().optional(),
  country_codes: z.array(z.string()).optional(),
  ministry_slugs: z.array(z.string()).optional(),
  force: z.boolean().optional().default(false),
  dry_run: z.boolean().optional().default(false),
  concurrency: z.number().int().min(1).max(5).optional().default(3),
});

type MinistryAction = {
  slug: string;
  name: string;
  action: "skipped" | "planned" | "updated" | "failed" | "unresolved";
  minister: string | null;
  confidence?: "low" | "medium" | "high";
  source_tier?: string;
  error?: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

async function runPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

function mergeProfile(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  const merged: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(incoming ?? {})) {
    if (k === "contact" || k === "socials") {
      const eSub = (existing?.[k] as Record<string, unknown>) ?? {};
      const iSub = (v as Record<string, unknown>) ?? {};
      const sub: Record<string, unknown> = { ...eSub };
      for (const [sk, sv] of Object.entries(iSub)) {
        if (isEmpty(sub[sk]) && !isEmpty(sv)) sub[sk] = sv;
      }
      merged[k] = sub;
      continue;
    }
    if (isEmpty(merged[k]) && !isEmpty(v)) merged[k] = v;
  }
  return merged;
}

function dedupCitations(a: any[], b: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const c of [...a, ...b]) {
    if (!c) continue;
    const url = typeof c === "string" ? c : c.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(typeof c === "string" ? { url } : c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Job orchestration
// ---------------------------------------------------------------------------

export const startMinisterBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Sweep: mark any stale "running" jobs (heartbeat >5 min old) as failed.
    await supabaseAdmin
      .from("minister_backfill_runs")
      .update({ status: "failed", error: "stalled", finished_at: new Date().toISOString() })
      .eq("status", "running")
      .lt("heartbeat_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    // Determine target countries.
    let countryQuery = supabaseAdmin.from("countries").select("code, name");
    const codes =
      (data.country_codes && data.country_codes.length ? data.country_codes : null) ??
      (data.country_code ? [data.country_code] : null);
    if (codes) countryQuery = countryQuery.in("code", codes);
    const { data: allCountries, error: cErr } = await countryQuery;
    if (cErr) throw new Error(`countries load failed: ${cErr.message}`);

    const { data: ministriesAll, error: mErr } = await supabaseAdmin
      .from("ministries")
      .select("country_code")
      .order("country_code");
    if (mErr) throw new Error(`ministries load failed: ${mErr.message}`);
    const withMinistries = new Set((ministriesAll ?? []).map((m: any) => m.country_code));
    const targets = (allCountries ?? []).filter((c: any) => withMinistries.has(c.code));

    if (targets.length === 0) throw new Error("No target countries with ministries.");

    // Create run row.
    const { data: run, error: runErr } = await supabaseAdmin
      .from("minister_backfill_runs")
      .insert({
        status: "queued",
        requested_by: context.userId,
        params: {
          country_codes: targets.map((c: any) => c.code),
          ministry_slugs: data.ministry_slugs ?? null,
          force: data.force,
          dry_run: data.dry_run,
          concurrency: data.concurrency,
        },
        totals: { attempted: 0, resolved: 0, updated: 0, skipped: 0, failed: 0 },
        heartbeat_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr) throw new Error(`run insert failed: ${runErr.message}`);

    // Create per-country queued rows.
    const countryRows = targets.map((c: any) => ({
      run_id: run.id,
      country_code: c.code,
      status: "queued",
    }));
    const { error: cRunErr } = await supabaseAdmin
      .from("minister_backfill_country_runs")
      .insert(countryRows);
    if (cRunErr) throw new Error(`country runs insert failed: ${cRunErr.message}`);

    // Fire-and-forget processing. The handler returns immediately; the UI polls.
    void processRun(run.id).catch(async (err) => {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      await admin
        .from("minister_backfill_runs")
        .update({
          status: "failed",
          error: (err as Error).message.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    });

    return { run_id: run.id as string };
  });

export const getMinisterBackfillRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run, error: rErr } = await supabaseAdmin
      .from("minister_backfill_runs")
      .select("*")
      .eq("id", data.run_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!run) throw new Error("Run not found");
    const { data: countries, error: cErr } = await supabaseAdmin
      .from("minister_backfill_country_runs")
      .select("*")
      .eq("run_id", data.run_id)
      .order("country_code");
    if (cErr) throw new Error(cErr.message);
    return { run, countries: countries ?? [] };
  });

export const listMinisterBackfillRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(50).optional().default(10) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: runs, error } = await supabaseAdmin
      .from("minister_backfill_runs")
      .select("id, status, params, totals, error, started_at, finished_at, heartbeat_at, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return runs ?? [];
  });

export const cancelMinisterBackfillRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("minister_backfill_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.run_id)
      .in("status", ["queued", "running"]);
    return { ok: true };
  });

// Back-compat sync wrapper: kicks off a job and polls until it completes.
export const backfillMinisters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const started = await startMinisterBackfill({ data });
    // Poll until terminal or timeout (~10 min max).
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data: run } = await supabaseAdmin
        .from("minister_backfill_runs")
        .select("status, totals, error")
        .eq("id", started.run_id)
        .single();
      if (run && !["queued", "running"].includes(run.status as string)) {
        const { data: countries } = await supabaseAdmin
          .from("minister_backfill_country_runs")
          .select("*")
          .eq("run_id", started.run_id);
        return {
          ok: run.status === "succeeded",
          run_id: started.run_id,
          dry_run: data.dry_run,
          force: data.force,
          totals: run.totals,
          countries: countries ?? [],
          error: run.error,
        };
      }
    }
    return { ok: false, run_id: started.run_id, timeout: true };
  });

// ---------------------------------------------------------------------------
// Background processor
// ---------------------------------------------------------------------------

async function processRun(runId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolveMinister } = await import("./minister-research.server");
  const { buildCountryContext } = await import("./country-context.server");

  const { data: run } = await supabaseAdmin
    .from("minister_backfill_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (!run) return;

  const params = (run.params ?? {}) as {
    country_codes?: string[];
    ministry_slugs?: string[] | null;
    force?: boolean;
    dry_run?: boolean;
    concurrency?: number;
  };
  const codes = params.country_codes ?? [];
  const dryRun = !!params.dry_run;
  const force = !!params.force;
  const concurrency = params.concurrency ?? 3;

  await supabaseAdmin
    .from("minister_backfill_runs")
    .update({ status: "running", started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
    .eq("id", runId);

  const { data: countryRows } = await supabaseAdmin
    .from("countries")
    .select("code, name")
    .in("code", codes);
  const nameByCode = new Map<string, string>();
  for (const c of (countryRows ?? []) as any[]) nameByCode.set(c.code, c.name);

  const totals = { attempted: 0, resolved: 0, updated: 0, skipped: 0, failed: 0 };

  for (const code of codes) {
    // Check for cancellation between countries.
    const { data: current } = await supabaseAdmin
      .from("minister_backfill_runs")
      .select("status")
      .eq("id", runId)
      .single();
    if (current?.status === "cancelled") {
      await supabaseAdmin
        .from("minister_backfill_country_runs")
        .update({ status: "cancelled" })
        .eq("run_id", runId)
        .eq("status", "queued");
      return;
    }

    const countryName = nameByCode.get(code) ?? code;
    await supabaseAdmin
      .from("minister_backfill_country_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("run_id", runId)
      .eq("country_code", code);

    try {
      const summary = await processCountry({
        countryCode: code,
        countryName,
        ministrySlugs: params.ministry_slugs ?? null,
        force,
        dryRun,
        concurrency,
        actor: run.requested_by,
        resolveMinister,
        buildCountryContext,
        admin: supabaseAdmin,
        onHeartbeat: async () => {
          await supabaseAdmin
            .from("minister_backfill_runs")
            .update({ heartbeat_at: new Date().toISOString() })
            .eq("id", runId);
        },
      });

      totals.attempted += summary.attempted;
      totals.resolved += summary.resolved;
      totals.updated += summary.updated;
      totals.skipped += summary.skipped;
      totals.failed += summary.failed;

      await supabaseAdmin
        .from("minister_backfill_country_runs")
        .update({
          status: "succeeded",
          attempted: summary.attempted,
          resolved: summary.resolved,
          updated: summary.updated,
          skipped: summary.skipped,
          failed: summary.failed,
          ministries: summary.ministries,
          finished_at: new Date().toISOString(),
        })
        .eq("run_id", runId)
        .eq("country_code", code);

      await supabaseAdmin
        .from("minister_backfill_runs")
        .update({ totals, heartbeat_at: new Date().toISOString() })
        .eq("id", runId);
    } catch (err) {
      await supabaseAdmin
        .from("minister_backfill_country_runs")
        .update({
          status: "failed",
          error: (err as Error).message.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("run_id", runId)
        .eq("country_code", code);
    }
  }

  await supabaseAdmin
    .from("minister_backfill_runs")
    .update({
      status: "succeeded",
      totals,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function processCountry(opts: {
  countryCode: string;
  countryName: string;
  ministrySlugs: string[] | null;
  force: boolean;
  dryRun: boolean;
  concurrency: number;
  actor: string | null;
  admin: any;
  resolveMinister: any;
  buildCountryContext: any;
  onHeartbeat: () => Promise<void>;
}): Promise<{
  attempted: number;
  resolved: number;
  updated: number;
  skipped: number;
  failed: number;
  ministries: MinistryAction[];
}> {
  const { admin, resolveMinister, buildCountryContext } = opts;

  const { data: ministries, error: mErr } = await admin
    .from("ministries")
    .select("slug, name")
    .eq("country_code", opts.countryCode)
    .order("slug");
  if (mErr) throw new Error(mErr.message);

  const slugFilter = opts.ministrySlugs?.length ? new Set(opts.ministrySlugs) : null;
  const filtered = (slugFilter
    ? (ministries ?? []).filter((m: any) => slugFilter.has(m.slug))
    : (ministries ?? [])) as Array<{ slug: string; name: string }>;

  const { data: existingProfiles } = await admin
    .from("ministry_profiles")
    .select("ministry_slug, minister, minister_profile, citations, source_ids, mandate, programmes")
    .eq("country_code", opts.countryCode);
  const existingBySlug = new Map<string, any>();
  for (const p of (existingProfiles ?? []) as any[]) existingBySlug.set(p.ministry_slug, p);

  const needsWork = filtered.filter((m) => {
    if (opts.force) return true;
    const p = existingBySlug.get(m.slug);
    if (!p) return true;
    const hasName = !!(p.minister && String(p.minister).trim());
    const profile = p.minister_profile ?? {};
    const hasProfile = profile && typeof profile === "object" && Object.keys(profile).length > 0;
    return !hasName || !hasProfile;
  });

  const out: MinistryAction[] = [];
  let resolved = 0, updated = 0, failed = 0;
  const skipped = filtered.length - needsWork.length;

  for (const m of filtered) {
    if (!needsWork.find((x) => x.slug === m.slug)) {
      out.push({
        slug: m.slug,
        name: m.name,
        action: "skipped",
        minister: existingBySlug.get(m.slug)?.minister ?? null,
      });
    }
  }

  if (needsWork.length === 0) {
    return { attempted: 0, resolved: 0, updated: 0, skipped, failed: 0, ministries: out };
  }

  let ctx: any;
  try {
    ctx = await buildCountryContext(admin, opts.countryCode);
  } catch (e) {
    out.push({
      slug: "*context*",
      name: "country context",
      action: "failed",
      minister: null,
      error: (e as Error).message,
    });
    return { attempted: needsWork.length, resolved: 0, updated: 0, skipped, failed: needsWork.length, ministries: out };
  }

  const results = await runPool(needsWork, opts.concurrency, async (m) => {
    try {
      const result = await resolveMinister({
        admin,
        countryCode: opts.countryCode,
        countryName: opts.countryName,
        ministry: m,
        ctx,
        actor: opts.actor ?? undefined,
      });
      return { m, result, error: null as string | null };
    } catch (e) {
      return { m, result: null, error: (e as Error).message };
    }
  });

  for (const { m, result, error } of results) {
    if (error || !result) {
      failed++;
      out.push({ slug: m.slug, name: m.name, action: "failed", minister: null, error: error ?? "unknown" });
      continue;
    }
    if (result.minister) resolved++;

    if (opts.dryRun) {
      out.push({
        slug: m.slug,
        name: m.name,
        action: result.minister ? "planned" : "unresolved",
        minister: result.minister,
        confidence: result.confidence,
        source_tier: result.source_tier,
      });
      await opts.onHeartbeat();
      continue;
    }

    const existing = existingBySlug.get(m.slug);
    const mergedProfile = mergeProfile(
      (existing?.minister_profile as Record<string, unknown>) ?? {},
      (result.minister_profile as Record<string, unknown>) ?? {},
    );
    const finalName =
      (mergedProfile.name as string | null) ?? result.minister ?? existing?.minister ?? null;
    const mergedCitations = dedupCitations(
      Array.isArray(existing?.citations) ? existing.citations : [],
      result.citations ?? [],
    );

    const { error: upErr } = await admin.from("ministry_profiles").upsert(
      {
        country_code: opts.countryCode,
        ministry_slug: m.slug,
        minister: finalName,
        minister_profile: { ...mergedProfile, name: finalName },
        mandate: existing?.mandate ?? result.mandate ?? "",
        programmes: existing?.programmes?.length ? existing.programmes : (result.programmes ?? []),
        source_ids: existing?.source_ids ?? [],
        citations: mergedCitations,
      },
      { onConflict: "country_code,ministry_slug" },
    );

    if (upErr) {
      failed++;
      out.push({
        slug: m.slug,
        name: m.name,
        action: "failed",
        minister: result.minister,
        error: upErr.message,
      });
      continue;
    }

    updated++;
    out.push({
      slug: m.slug,
      name: m.name,
      action: result.minister ? "updated" : "unresolved",
      minister: result.minister,
      confidence: result.confidence,
      source_tier: result.source_tier,
    });
    await opts.onHeartbeat();
  }

  return { attempted: needsWork.length, resolved, updated, skipped, failed, ministries: out };
}
