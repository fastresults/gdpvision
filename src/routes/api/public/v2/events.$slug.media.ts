// GDPVision partner API v2 · recent public news signals for a summit host country (scopes "events" + "media").
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/events/$slug/media")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request, params }) => {
        const m = await import("@/lib/public-data/partner.server");
        return m.withPartner(request, (id) => m.readEventMedia(id, String(params.slug)));
      },
    },
  },
});
