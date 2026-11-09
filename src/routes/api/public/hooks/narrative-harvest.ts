// Chamber 05 · hourly cross-country press harvest.
// Called by pg_cron every hour. Sweeps every active feed across all countries
// via runPressTick (no filterCountry). Same auth pattern as press-tick.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/narrative-harvest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyHookRequest, unauthorizedHook } = await import("@/lib/auth/verify-hook.server");
        if (!(await verifyHookRequest(request))) return unauthorizedHook();

        const { runGuardedPressTick, ScanBlocked } = await import("@/lib/press-tick.server");
        try {
          const result = await runGuardedPressTick({
            windowKey: "hourly",
            filterCountry: null,
            triggeredBy: "cron",
            automatic: true,
          });
          return Response.json(result);
        } catch (e) {
          if (e instanceof ScanBlocked) return Response.json({ ok: false, skipped: e.message });
          return new Response((e as Error).message, { status: 500 });
        }
      },
    },
  },
});
