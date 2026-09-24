// Monthly Caribbean peer-analysis hook. Called by pg_cron (1st of month, 02:00 UTC)
// with the scheduler secret in x-hook-secret.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/peer-analysis")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyHookRequest, unauthorizedHook } = await import("@/lib/auth/verify-hook.server");
        if (!(await verifyHookRequest(request))) return unauthorizedHook();
        const { runPeerAnalysis } = await import("@/lib/sovereign-eye/peer-analysis.server");
        const result = await runPeerAnalysis();
        return Response.json(result);
      },
    },
  },
});
