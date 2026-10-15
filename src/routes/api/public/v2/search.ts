// GDPVision partner API v2 · search public Second Brain facts and sources.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/search")({
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
          m.searchPublicBrain(id, {
            q: p.get("q") ?? "",
            countries: p.get("country")?.split(","),
            sector: p.get("sector"),
            limit: Number(p.get("limit") ?? 25),
          }),
        );
      },
    },
  },
});
