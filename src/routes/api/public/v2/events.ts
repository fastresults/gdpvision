// GDPVision partner API v2 · published GDP Events editions (scope "events"). ?upcoming=1 future only, ?series=<slug> one summit.
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
        const sp = new URL(request.url).searchParams;
        return m.withPartner(request, (id) => m.readPublicEvents(id, { upcomingOnly: sp.get("upcoming") === "1", series: sp.get("series") }));
      },
    },
  },
});
