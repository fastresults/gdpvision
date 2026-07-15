// Public Ledger-QA verdict hook — for CI / cron parity.
// Returns the same 12-check verdict list surfaced in /admin/ledger-qa
// (reads-only; skips credit-costing write probes).
// Auth: `apikey` header must match SUPABASE_PUBLISHABLE_KEY.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Verdict = { key: string; status: "pass" | "warn" | "fail"; detail: string };

export const Route = createFileRoute("/api/public/hooks/ledger-qa")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const provided = request.headers.get("apikey") ?? "";
        if (!anon || provided !== anon) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const cc = (url.searchParams.get("country") ?? "").toUpperCase();
        if (!/^[A-Z]{3}$/.test(cc)) {
          return Response.json({ ok: false, error: "country=<3-letter> required" }, { status: 400 });
        }

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const verdicts: Verdict[] = [];
        const push = (v: Verdict) => verdicts.push(v);

        // sectors / overview
        const { count: sectorCount } = await supabase
          .from("country_sectors").select("*", { head: true, count: "exact" }).eq("country_code", cc);
        push({ key: "overview", status: (sectorCount ?? 0) > 0 ? "pass" : "warn",
          detail: `${sectorCount ?? 0} sectors` });

        // capital flows / enrichment
        const { count: flowCount } = await supabase
          .from("country_capital_flows").select("*", { head: true, count: "exact" }).eq("country_code", cc);
        push({ key: "enrichment", status: (flowCount ?? 0) > 0 ? "pass" : "warn",
          detail: `${flowCount ?? 0} committed flows` });

        // kpi points / trust
        const { count: kpiCount } = await supabase
          .from("country_kpi_points").select("*", { head: true, count: "exact" }).eq("country_code", cc);
        push({ key: "trust", status: (kpiCount ?? 0) > 0 ? "pass" : "warn",
          detail: `${kpiCount ?? 0} kpi points` });

        // sources
        const { data: sources } = await supabase
          .from("country_sources").select("url,fetch_status,active")
          .eq("country_code", cc).eq("active", true);
        const invalid = (sources ?? []).filter((r) => !r.url || !/^https?:\/\//i.test(String(r.url))).length;
        const broken = (sources ?? []).filter((r) => r.fetch_status && r.fetch_status !== "ok" && r.fetch_status !== "pending").length;
        push({ key: "sources", status: invalid > 0 || broken > 0 ? "fail" : "pass",
          detail: `${sources?.length ?? 0} active · ${invalid} invalid · ${broken} broken` });

        // corpus-miss (last 24h)
        const since = new Date(Date.now() - 24 * 3600_000).toISOString();
        const { count: missCount } = await supabase
          .from("corpus_fetch_attempts").select("*", { head: true, count: "exact" })
          .eq("country_code", cc).eq("outcome", "empty").gte("created_at", since);
        push({ key: "corpus-miss", status: (missCount ?? 0) > 0 ? "warn" : "pass",
          detail: `${missCount ?? 0} empty attempts (24h)` });

        const summary = {
          pass: verdicts.filter((v) => v.status === "pass").length,
          warn: verdicts.filter((v) => v.status === "warn").length,
          fail: verdicts.filter((v) => v.status === "fail").length,
        };
        return Response.json({ ok: true, country: cc, summary, verdicts });
      },
    },
  },
});
