// GDPVision partner API v2 · summit series with their published editions (scope "events").
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/events/series")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request }) => {
        const m = await import("@/lib/public-data/partner.server");
        return m.withPartner(request, (id) => m.readPublicEventSeries(id));
      },
    },
  },
});
