// @domain personas
// @tables programme_decks
// @ui src/routes/p.$token.tsx
//
// The client's door to a presentation. One coded link resolves exactly one
// programme's deck. Nothing about the platform, the workspace, the country
// queue or any participant is returned — only the presentation.

import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/deck/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "").slice(0, 120);
        if (!/^[a-f0-9]{24,96}$/.test(token)) return json({ state: "invalid" }, 404);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("programme_decks")
          .select("share_enabled,deck")
          .eq("share_token", token)
          .maybeSingle();

        if (!row) return json({ state: "invalid" }, 404);
        if (!row.share_enabled) return json({ state: "revoked" }, 410);

        const deck = row.deck as unknown as {
          preflight?: { ready: boolean }[];
          slides?: unknown[];
        } | null;
        if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) {
          return json({ state: "invalid" }, 404);
        }
        // A presentation that has not passed its provenance check is never served.
        if (!(deck.preflight ?? []).every((p) => p.ready)) return json({ state: "unavailable" }, 409);

        return json({ state: "ok", deck });
      },
    },
  },
});
