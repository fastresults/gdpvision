// GDPVision public API v1 · one resource for one country.
//
// GET /api/public/v1/countries/:code/:resource, Bearer key. Resources and the
// envelope are defined in src/lib/egov/api.server.ts. Only public, approved
// material is served; the key's country must match the path.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/countries/$code/$resource")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/egov/api.server");
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      },
      GET: async ({ request, params }) => {
        const { authenticate, problem, serveResource } = await import("@/lib/egov/api.server");
        const identity = await authenticate(request);
        if (!identity)
          return problem(
            request,
            401,
            "Unauthorized",
            "Send a valid key as Authorization: Bearer gdpv_<code>_…",
          );
        return serveResource(
          request,
          identity,
          String(params.code ?? ""),
          String(params.resource ?? ""),
        );
      },
    },
  },
});
