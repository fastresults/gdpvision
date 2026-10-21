// GDPVision partner API v2 · POST a registration from a partner site (scope "events_register"). Attendee data is never returned.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/events/$slug/register")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      POST: async ({ request, params }) => {
        const m = await import("@/lib/public-data/partner.server");
        const f = await import("@/lib/public-data/events-feed");
        const id = await m.authenticatePartner(request);
        if (!id) return m.partnerProblem(request, 401, "Unauthorized", "Send a partner key as Authorization: Bearer gdpp_…");
        try {
          const body = await request.json().catch(() => null);
          const r = await m.registerViaPartner(id, String(params.slug), body);
          return m.partnerJson(request, { version: m.PARTNER_API_VERSION, ...r }, f.registerStatus(r), id);
        } catch (e) {
          const err = e as Error & { status?: number };
          return m.partnerProblem(request, err.status ?? 500, err.status ? err.message : "Server error", undefined, id);
        }
      },
    },
  },
});
