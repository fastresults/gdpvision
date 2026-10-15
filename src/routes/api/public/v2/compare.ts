// GDPVision partner API v2 · compare one public KPI across countries.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/compare")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request }) => {
        const m = await import("@/lib/public-data/partner.server");
        const p = new URL(request.url).searchParams;
        return m.withPartner(request, (id) =>
          m.compareKpi(id, { metric: p.get("metric") ?? "", countries: p.get("countries")?.split(",") }),
        );
      },
    },
  },
});
