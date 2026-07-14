// Ledger-QA remediators + audit reader. Super-admin gated.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — super admin only");
}

/**
 * Systemic repair for the "invalid URL text stored in country_sources.url" bug.
 * Idempotent: any row whose url does not start with http(s):// is marked
 * active=false, fetch_status='invalid_url', and the offending text is copied
 * into fetch_error for audit. No deletes.
 */
export const repairInvalidSourceUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ countryCode: z.string().length(3) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error: selErr } = await supabaseAdmin
      .from("country_sources")
      .select("id, url, active, fetch_status")
      .eq("country_code", data.countryCode);
    if (selErr) throw new Error(selErr.message);

    const invalid = (rows ?? []).filter(
      (r: any) => !r.url || !/^https?:\/\//i.test(String(r.url)),
    );
    const rowsBefore = invalid.length;
    const activeBefore = invalid.filter((r: any) => r.active === true).length;

    for (const r of invalid) {
      await supabaseAdmin
        .from("country_sources")
        .update({
          active: false,
          fetch_status: "invalid_url",
          fetch_error: `Non-URL text quarantined by Ledger-QA: ${String(r.url ?? "").slice(0, 300)}`,
        })
        .eq("id", r.id);
    }

    await supabaseAdmin.from("ledger_qa_actions").insert({
      country_code: data.countryCode,
      check_key: "sources",
      finding_class: "data-quality",
      action: "repairInvalidSourceUrls",
      rows_before: activeBefore,
      rows_after: 0,
      detail: { totalInvalid: rowsBefore, activeQuarantined: activeBefore },
      actor: context.userId,
    });

    return {
      rowsFixed: rowsBefore,
      activeQuarantined: activeBefore,
      sample: invalid.slice(0, 3).map((r: any) => String(r.url ?? "").slice(0, 200)),
    };
  });

/**
 * Retry HEAD-check for sources that have a real https URL but a failing
 * last_status. Skips invalid_url rows entirely. Reuses source_health_checks.
 */
export const retryUnreachableSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ countryCode: z.string().length(3) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("country_sources")
      .select("id, url, active")
      .eq("country_code", data.countryCode)
      .eq("active", true);
    if (error) throw new Error(error.message);

    const targets = (rows ?? []).filter(
      (r: any) => r.url && /^https?:\/\//i.test(String(r.url)),
    );

    let attempted = 0;
    let ok = 0;
    for (const r of targets) {
      attempted++;
      let status: string = "unreachable";
      let httpStatus: number | null = null;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(r.url, { method: "HEAD", signal: ctrl.signal });
        clearTimeout(t);
        httpStatus = res.status;
        status = res.ok ? "ok" : `http_${res.status}`;
        if (res.ok) ok++;
      } catch (e) {
        status = `err_${(e as Error).name}`;
      }
      await supabaseAdmin.from("source_health_checks").insert({
        source_id: r.id,
        status,
        http_status: httpStatus,
      });
      await supabaseAdmin
        .from("country_sources")
        .update({
          fetch_status: status === "ok" ? "ok" : status,
          last_fetched_at: new Date().toISOString(),
        })
        .eq("id", r.id);
    }

    await supabaseAdmin.from("ledger_qa_actions").insert({
      country_code: data.countryCode,
      check_key: "sources",
      finding_class: "external-outage",
      action: "retryUnreachableSources",
      rows_before: attempted,
      rows_after: ok,
      detail: { attempted, ok, failed: attempted - ok },
      actor: context.userId,
    });

    return { attempted, ok, failed: attempted - ok };
  });

/** Recent audit rows for the country (last 10). */
export const recentQaActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ countryCode: z.string().length(3) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("ledger_qa_actions")
      .select("id, check_key, finding_class, action, rows_before, rows_after, detail, created_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
