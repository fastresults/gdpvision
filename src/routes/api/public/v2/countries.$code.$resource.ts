// GDPVision partner API v2 · one public resource for one country (same filters as v1).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/countries/$code/$resource")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request, params }) => {
        const m = await import("@/lib/public-data/partner.server");
        const since = new URL(request.url).searchParams.get("since");
        return m.withPartner(request, (id) =>
          m.readCountryResource(id, String(params.code ?? ""), String(params.resource ?? ""), since),
        );
      },
    },
  },
});
