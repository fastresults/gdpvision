// GDPVision partner API v2 · one Caribbean Index (CGX, CHX, CGV, CCX) from a published
// edition: ?edition=<release id>|latest (default latest), ?countries=ATG,KNA.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v2/indices/$index")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { partnerCors } = await import("@/lib/public-data/partner.server");
        return new Response(null, { status: 204, headers: partnerCors(request) });
      },
      GET: async ({ request, params }) => {
        const m = await import("@/lib/public-data/partner.server");
        const sp = new URL(request.url).searchParams;
        const countries = (sp.get("countries") ?? "").split(",").filter(Boolean);
        return m.withPartner(request, (id) =>
          m.readIndexEdition(id, String(params.index ?? ""), sp.get("edition"), countries),
        );
      },
    },
  },
});
