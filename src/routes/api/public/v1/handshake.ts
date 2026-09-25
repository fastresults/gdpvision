// GDPVision public API v1 · handshake.
//
// A country's e-government platform calls this first with its key. The reply
// says who the key is for, what it may read, where each resource lives, and
// the brand payload (tokens, flag, imagery rules) so the platform can render
// its chrome before any other call. See src/lib/egov/api.server.ts.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/handshake")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/egov/api.server");
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      },
      GET: async ({ request }) => {
        const { authenticate, problem, serveHandshake } = await import("@/lib/egov/api.server");
        const identity = await authenticate(request);
        if (!identity)
          return problem(
            request,
            401,
            "Unauthorized",
            "Send a valid key as Authorization: Bearer gdpv_<code>_…",
          );
        return serveHandshake(request, identity);
      },
    },
  },
});
