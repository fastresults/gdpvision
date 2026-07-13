import { createFileRoute } from "@tanstack/react-router";

function isAuthorized(request: Request) {
  const provided = request.headers.get("apikey") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  return !!expected && provided === expected;
}

export const Route = createFileRoute("/api/public/hooks/onboarding-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) return new Response("forbidden", { status: 401 });
        let body: { countryCode?: string; limit?: number } = {};
        try { body = await request.json(); } catch { /* empty body ok */ }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processOnboardingJobs } = await import("@/lib/country-onboarding/durable-worker.server");
        const result = await processOnboardingJobs(supabaseAdmin, {
          countryCode: body.countryCode,
          limit: Math.max(1, Math.min(Number(body.limit ?? 1), 2)),
        });
        return Response.json(result);
      },
    },
  },
});