// Chamber 05 · press-monitoring tick.
// Called by pg_cron with an x-hook-secret header (scheduler secret).
import { createFileRoute } from "@tanstack/react-router";

type PressTickRequest = { window?: string; country?: string };

export const Route = createFileRoute("/api/public/hooks/press-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyHookRequest, unauthorizedHook } = await import("@/lib/auth/verify-hook.server");
        if (!(await verifyHookRequest(request))) return unauthorizedHook();

        const body = (await request.json().catch(() => ({}))) as PressTickRequest;
        const { runGuardedPressTick, ScanBlocked } = await import("@/lib/press-tick.server");
        try {
          const result = await runGuardedPressTick({
            windowKey: body.window ?? "adhoc",
            filterCountry: body.country ?? null,
            triggeredBy: body.country ? "manual" : "cron",
            // Schedules (and any call from them) only run while the switch is on.
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
