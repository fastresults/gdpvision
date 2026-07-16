// Source-health cron hook (Phase 5 stewardship).
// HEAD-checks every active country_source URL, logs into
// source_health_checks, and updates country_sources.fetch_status.
// Called by pg_cron with `apikey` header = anon key.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/hooks/source-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const provided = request.headers.get("apikey") ?? "";
        if (!anon || provided !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

        const { data: sources, error } = await supabase
          .from("country_sources")
          .select("id,url,country_code,last_fetched_at")
          .eq("active", true)
          .eq("visibility", "public")
          .not("url", "is", null)
          .order("last_fetched_at", { ascending: true, nullsFirst: true })
          .limit(limit);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let checked = 0;
        let ok = 0;
        for (const s of sources ?? []) {
          if (!s.url) continue;
          checked++;
          const t0 = Date.now();
          let status: number | null = null;
          let good = false;
          let err: string | null = null;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const r = await fetch(s.url, { method: "HEAD", redirect: "follow", signal: controller.signal });
            clearTimeout(timer);
            status = r.status;
            good = r.ok;
          } catch (e) {
            err = e instanceof Error ? e.message : String(e);
          }
          const latency = Date.now() - t0;
          if (good) ok++;
          await supabase.from("source_health_checks").insert({
            country_code: s.country_code as string,
            source_id: s.id as string,
            http_status: status,
            ok: good,
            latency_ms: latency,
            error: err,
          });
          await supabase
            .from("country_sources")
            .update({
              last_fetched_at: new Date().toISOString(),
              fetch_status: good ? "ok" : status ? `http_${status}` : "error",
              fetch_error: err,
            })
            .eq("id", s.id as string);
        }

        return Response.json({ ok: true, checked, healthy: ok, failed: checked - ok });
      },
    },
  },
});
