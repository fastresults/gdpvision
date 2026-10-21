// GDPVision partner API v2 · one published edition with agenda, speakers, partners and photos (scope "events").
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/events/$slug")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request, params }) => {
        const m = await import("@/lib/public-data/partner.server");
        return m.withPartner(request, (id) => m.readPublicEvent(id, String(params.slug)));
      },
    },
  },
});
