// GDPVision partner API v2 · directory of countries this key can read.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/countries")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request }) => {
        const m = await import("@/lib/public-data/partner.server");
        return m.withPartner(request, async (id) => {
          const data = await m.listPublicCountries(id);
          return { partner: id.partner, scopes: id.scopes, count: data.length, data };
        });
      },
    },
  },
});
