// Caribbean Indices hook. Called by pg_cron with the scheduler secret in x-hook-secret:
// weekly { "mode": "watch" } (Mondays 05:10 UTC) and monthly { "mode": "tracker" } (2nd, 05:20 UTC).
// An official edition is never started here — only by an admin (indices.functions.ts).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/indices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyHookRequest, unauthorizedHook } =
          await import("@/lib/auth/verify-hook.server");
        if (!(await verifyHookRequest(request))) return unauthorizedHook();
        const body = (await request.json().catch(() => ({}))) as { mode?: string };
        const mode = body.mode === "tracker" ? "tracker" : "watch";
        const { runIndices } = await import("@/lib/indices/run.server");
        try {
          const result = await runIndices({ mode, trigger: "scheduled" });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
