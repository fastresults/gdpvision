// Public Ledger-QA verdict hook — for CI / cron parity.
// Returns the same 12-check verdict list surfaced in /admin/ledger-qa
// (reads-only; skips credit-costing write probes).
// Auth: `apikey` header must match LEDGER_QA_HOOK_KEY (dedicated secret,
// NOT the anon publishable key — this endpoint runs privileged reads).

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Verdict = {
  key: string;
  status: "pass" | "warn" | "fail" | "skipped";
  detail: string;
  ms: number;
};

const PROBE_KEYS = ["explain", "ask", "ask-refuse", "snapshot-rt", "handoff"];

export const Route = createFileRoute("/api/public/hooks/ledger-qa")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.LEDGER_QA_HOOK_KEY ?? "";
        const provided = request.headers.get("apikey") ?? "";
        if (!key || provided !== key) return new Response("Unauthorized", { status: 401 });

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

        const runId = crypto.randomUUID();
        const startedAt = new Date().toISOString();
        const verdicts: Verdict[] = [];
        const time = async <T,>(key: string, fn: () => Promise<Verdict>): Promise<void> => {
          const t0 = Date.now();
          try {
            const v = await fn();
            verdicts.push({ ...v, ms: Date.now() - t0 });
          } catch (e) {
            verdicts.push({ key, status: "fail", detail: (e as Error).message, ms: Date.now() - t0 });
          }
        };

        // overview: sector composition
        await time("overview", async () => {
          const { count } = await supabase
            .from("country_sectors").select("*", { head: true, count: "exact" }).eq("country_code", cc);
          return { key: "overview", status: (count ?? 0) > 0 ? "pass" : "warn", detail: `${count ?? 0} sectors`, ms: 0 };
        });

        // enrichment: capital flows
        await time("enrichment", async () => {
          const { count } = await supabase
            .from("country_capital_flows").select("*", { head: true, count: "exact" }).eq("country_code", cc);
          return { key: "enrichment", status: (count ?? 0) > 0 ? "pass" : "warn", detail: `${count ?? 0} committed flows`, ms: 0 };
        });

        // trust: kpis with latest_value + freshness
        await time("trust", async () => {
          const { count } = await supabase
            .from("country_kpis").select("*", { head: true, count: "exact" })
            .eq("country_code", cc).not("latest_value", "is", null);
          return { key: "trust", status: (count ?? 0) > 0 ? "pass" : "warn", detail: `${count ?? 0} kpis with latest_value`, ms: 0 };
        });

        // recon: shares vs flows residual (rough parity — sum(sectors.share_pct) close to 100)
        await time("recon", async () => {
          const { data: shares } = await supabase
            .from("country_sectors").select("share_pct").eq("country_code", cc);
          const sum = (shares ?? []).reduce((s, r) => s + Number(r.share_pct ?? 0), 0);
          const diff = Math.abs(sum - 100);
          if (!shares || shares.length === 0) return { key: "recon", status: "warn", detail: "no sectors", ms: 0 };
          return {
            key: "recon",
            status: diff <= 5 ? "pass" : "warn",
            detail: `sum=${sum.toFixed(1)}% (Δ${diff.toFixed(1)})`,
            ms: 0,
          };
        });

        // sources: url validity + last fetch status
        await time("sources", async () => {
          const { data } = await supabase
            .from("country_sources").select("url,fetch_status,active")
            .eq("country_code", cc).eq("active", true);
          const invalid = (data ?? []).filter((r) => !r.url || !/^https?:\/\//i.test(String(r.url))).length;
          const broken = (data ?? []).filter((r) => r.fetch_status && r.fetch_status !== "ok" && r.fetch_status !== "pending").length;
          return {
            key: "sources",
            status: invalid > 0 || broken > 0 ? "fail" : "pass",
            detail: `${data?.length ?? 0} active · ${invalid} invalid · ${broken} broken`,
            ms: 0,
          };
        });

        // gate: derive publish gate from the individual signals above
        await time("gate", async () => {
          const cascade = verdicts.filter((v) => ["overview", "enrichment", "trust", "sources"].includes(v.key));
          const blocked = cascade.filter((v) => v.status !== "pass").map((v) => v.key);
          return {
            key: "gate",
            status: blocked.length === 0 ? "pass" : "warn",
            detail: blocked.length === 0 ? "All gates green" : `Blocked: ${blocked.join(", ")}`,
            ms: 0,
          };
        });

        // corpus-miss: empty attempts in last 24h
        await time("corpus-miss", async () => {
          const since = new Date(Date.now() - 24 * 3600_000).toISOString();
          const { count } = await supabase
            .from("corpus_fetch_attempts").select("*", { head: true, count: "exact" })
            .eq("country_code", cc).eq("outcome", "empty").gte("created_at", since);
          return {
            key: "corpus-miss",
            status: (count ?? 0) > 0 ? "warn" : "pass",
            detail: `${count ?? 0} empty attempts (24h)`,
            ms: 0,
          };
        });

        // Write probes are skipped in the public hook (they cost credits / write rows).
        for (const k of PROBE_KEYS) {
          verdicts.push({ key: k, status: "skipped", detail: "write-probe · run via /admin/ledger-qa", ms: 0 });
        }

        const summary = {
          pass: verdicts.filter((v) => v.status === "pass").length,
          warn: verdicts.filter((v) => v.status === "warn").length,
          fail: verdicts.filter((v) => v.status === "fail").length,
          skipped: verdicts.filter((v) => v.status === "skipped").length,
          wallMs: verdicts.reduce((s, v) => s + v.ms, 0),
        };
        return Response.json({
          ok: true,
          run_id: runId,
          started_at: startedAt,
          country: cc,
          summary,
          verdicts,
        });
      },
    },
  },
});
