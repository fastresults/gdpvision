// Admin-only backfill: fill in ministry_profiles.minister and
// ministry_profiles.minister_profile for every existing country that already
// has ministries, using the 4-pass resolveMinister loop.
//
// Idempotent by default: only touches rows where minister IS NULL OR
// minister_profile = '{}'. Pass force:true to re-resolve everything.
// Pass dry_run:true to preview the plan without writing.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  country_code: z.string().optional(),
  ministry_slugs: z.array(z.string()).optional(),
  force: z.boolean().optional().default(false),
  dry_run: z.boolean().optional().default(false),
  concurrency: z.number().int().min(1).max(5).optional().default(3),
});

type CountrySummary = {
  country_code: string;
  country_name: string;
  attempted: number;
  resolved: number;
  updated: number;
  skipped: number;
  failed: number;
  ministries: Array<{
    slug: string;
    name: string;
    action: "skipped" | "planned" | "updated" | "failed" | "unresolved";
    minister: string | null;
    confidence?: "low" | "medium" | "high";
    source_tier?: string;
    error?: string;
  }>;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

// Small concurrency helper — process items N-at-a-time.
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
  // Merge shallowly, preferring non-null/non-empty existing values so we don't
  // clobber a stronger profile with a weaker one. Deep-merge contact + socials.
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

export const backfillMinisters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveMinister } = await import("./minister-research.server");
    const { buildCountryContext } = await import("./country-context.server");

    // 1. Pick target countries
    let countryQuery = supabaseAdmin.from("countries").select("code, name");
    if (data.country_code) countryQuery = countryQuery.eq("code", data.country_code);
    const { data: allCountries, error: cErr } = await countryQuery;
    if (cErr) throw new Error(`countries load failed: ${cErr.message}`);

    // Keep only countries that have at least one ministry.
    const { data: ministriesAll, error: mErr } = await supabaseAdmin
      .from("ministries")
      .select("country_code, slug, name")
      .order("country_code");
    if (mErr) throw new Error(`ministries load failed: ${mErr.message}`);

    const byCountry = new Map<string, Array<{ slug: string; name: string }>>();
    for (const m of (ministriesAll ?? []) as Array<{ country_code: string; slug: string; name: string }>) {
      const list = byCountry.get(m.country_code) ?? [];
      list.push({ slug: m.slug, name: m.name });
      byCountry.set(m.country_code, list);
    }

    const targets = (allCountries ?? []).filter((c: any) => byCountry.has(c.code));

    const summaries: CountrySummary[] = [];

    for (const country of targets as Array<{ code: string; name: string }>) {
      const allMinistries = byCountry.get(country.code) ?? [];
      const slugFilter = data.ministry_slugs?.length ? new Set(data.ministry_slugs) : null;
      const ministries = slugFilter
        ? allMinistries.filter((m) => slugFilter.has(m.slug))
        : allMinistries;

      // Existing profiles for gap detection
      const { data: existingProfiles } = await supabaseAdmin
        .from("ministry_profiles")
        .select("ministry_slug, minister, minister_profile, citations, source_ids, mandate, programmes")
        .eq("country_code", country.code);
      const existingBySlug = new Map<string, any>();
      for (const p of (existingProfiles ?? []) as any[]) {
        existingBySlug.set(p.ministry_slug, p);
      }

      const needsWork = ministries.filter((m) => {
        if (data.force) return true;
        const p = existingBySlug.get(m.slug);
        if (!p) return true; // no profile row
        const hasName = !!(p.minister && String(p.minister).trim());
        const profile = p.minister_profile ?? {};
        const hasProfile =
          profile && typeof profile === "object" && Object.keys(profile).length > 0;
        return !hasName || !hasProfile;
      });

      const summary: CountrySummary = {
        country_code: country.code,
        country_name: country.name,
        attempted: needsWork.length,
        resolved: 0,
        updated: 0,
        skipped: ministries.length - needsWork.length,
        failed: 0,
        ministries: [],
      };

      // Emit skipped rows for visibility
      for (const m of ministries) {
        if (!needsWork.find((x) => x.slug === m.slug)) {
          summary.ministries.push({
            slug: m.slug,
            name: m.name,
            action: "skipped",
            minister: existingBySlug.get(m.slug)?.minister ?? null,
          });
        }
      }

      if (needsWork.length === 0) {
        summaries.push(summary);
        continue;
      }

      let ctx: any = null;
      try {
        ctx = await buildCountryContext(supabaseAdmin, country.code);
      } catch (e) {
        summary.ministries.push({
          slug: "*context*",
          name: "country context",
          action: "failed",
          minister: null,
          error: (e as Error).message,
        });
        summary.failed = needsWork.length;
        summaries.push(summary);
        continue;
      }

      const results = await runPool(needsWork, data.concurrency, async (m) => {
        try {
          const result = await resolveMinister({
            admin: supabaseAdmin,
            countryCode: country.code,
            countryName: country.name,
            ministry: m,
            ctx,
            actor: context.userId,
          });
          return { m, result, error: null as string | null };
        } catch (e) {
          return { m, result: null, error: (e as Error).message };
        }
      });

      for (const { m, result, error } of results) {
        if (error || !result) {
          summary.failed++;
          summary.ministries.push({
            slug: m.slug,
            name: m.name,
            action: "failed",
            minister: null,
            error: error ?? "unknown",
          });
          continue;
        }
        if (result.minister) summary.resolved++;

        if (data.dry_run) {
          summary.ministries.push({
            slug: m.slug,
            name: m.name,
            action: result.minister ? "planned" : "unresolved",
            minister: result.minister,
            confidence: result.confidence,
            source_tier: result.source_tier,
          });
          continue;
        }

        // Upsert with merge semantics
        const existing = existingBySlug.get(m.slug);
        const mergedProfile = mergeProfile(
          (existing?.minister_profile as Record<string, unknown>) ?? {},
          (result.minister_profile as Record<string, unknown>) ?? {},
        );
        const finalName =
          (mergedProfile.name as string | null) ??
          result.minister ??
          existing?.minister ??
          null;
        const mergedCitations = dedupCitations(
          Array.isArray(existing?.citations) ? existing.citations : [],
          result.citations ?? [],
        );

        const { error: upErr } = await supabaseAdmin
          .from("ministry_profiles")
          .upsert(
            {
              country_code: country.code,
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
          summary.failed++;
          summary.ministries.push({
            slug: m.slug,
            name: m.name,
            action: "failed",
            minister: result.minister,
            error: upErr.message,
          });
          continue;
        }

        summary.updated++;
        summary.ministries.push({
          slug: m.slug,
          name: m.name,
          action: result.minister ? "updated" : "unresolved",
          minister: result.minister,
          confidence: result.confidence,
          source_tier: result.source_tier,
        });
      }

      summaries.push(summary);
    }

    const totals = summaries.reduce(
      (acc, s) => ({
        attempted: acc.attempted + s.attempted,
        resolved: acc.resolved + s.resolved,
        updated: acc.updated + s.updated,
        skipped: acc.skipped + s.skipped,
        failed: acc.failed + s.failed,
      }),
      { attempted: 0, resolved: 0, updated: 0, skipped: 0, failed: 0 },
    );

    return { ok: true, dry_run: data.dry_run, force: data.force, totals, countries: summaries };
  });
