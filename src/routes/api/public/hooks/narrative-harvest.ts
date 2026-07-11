// Harvest cron — public POST hook called by pg_cron.
// Skeleton: records a harvest_runs entry. Real collectors bolt in per Country Pack.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/hooks/narrative-harvest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.HARVEST_HOOK_SECRET;
        if (secret) {
          const provided = request.headers.get("x-harvest-secret");
          if (provided !== secret) return new Response("forbidden", { status: 401 });
        }

        let body: { scopeKey?: string; cadenceSlot?: string } = {};
        try { body = await request.json(); } catch { /* empty body ok */ }
        const scopeKey = body.scopeKey ?? "REGIONAL";
        const cadenceSlot = body.cadenceSlot ?? new Date().toISOString().slice(11, 13) + ":00";

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: run, error } = await supabase
          .from("harvest_runs")
          .insert({
            scope_key: scopeKey,
            cadence_slot: cadenceSlot,
            counts: { collectors: 0, candidates: 0 },
            failures: [],
          })
          .select("id")
          .single();
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        // Placeholder: real collectors (NSO releases, IMF/ECCB feeds, sanctioned news)
        // enqueue candidates into public.intake_items here.

        await supabase
          .from("harvest_runs")
          .update({ finished_at: new Date().toISOString() })
          .eq("id", run.id);

        return Response.json({ ok: true, runId: run.id, scopeKey, cadenceSlot });
      },
    },
  },
});
