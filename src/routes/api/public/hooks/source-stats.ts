// Chamber 05 · daily source-strength recompute. Called by pg_cron with the hook secret.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/source-stats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyHookRequest, unauthorizedHook } = await import("@/lib/auth/verify-hook.server");
        if (!(await verifyHookRequest(request))) return unauthorizedHook();
        const { withScanLock } = await import("@/lib/media-scan.server");
        const { recomputeSourceStats } = await import("@/lib/narrative-source-stats.server");
        try {
          const r = await withScanLock(`source-stats:${Date.now()}`, 10, recomputeSourceStats, "source-stats");
          return Response.json(r);
        } catch (e) {
          return new Response((e as Error).message, { status: 409 });
        }
      },
    },
  },
});
