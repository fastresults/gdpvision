// GDPVision partner API v2 · published GDP Events (needs the "events" scope). ?upcoming=1 for future events only.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/events")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request }) => {
        const m = await import("@/lib/public-data/partner.server");
        const upcomingOnly = new URL(request.url).searchParams.get("upcoming") === "1";
        return m.withPartner(request, (id) => m.readPublicEvents(id, { upcomingOnly }));
      },
    },
  },
});
