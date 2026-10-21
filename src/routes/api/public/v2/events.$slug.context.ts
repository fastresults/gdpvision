// GDPVision partner API v2 · host-country sector figures and public Second Brain facts for a summit (scopes "events" + "events_context").
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/events/$slug/context")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request, params }) => {
        const m = await import("@/lib/public-data/partner.server");
        return m.withPartner(request, (id) => m.readEventContext(id, String(params.slug)));
      },
    },
  },
});
