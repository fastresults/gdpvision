// @domain personas
// @tables programme_briefings,programme_decks
// @ui src/routes/d.$token.tsx
//
// The client's door to a dossier. One coded link resolves exactly one
// programme's briefing and its matching deck. Nothing about the platform, the
// workspace, the country queue or any participant is returned — only the
// document the client commissioned.

import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/dossier/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "").slice(0, 120);
        if (!/^[a-f0-9]{24,96}$/.test(token)) return json({ state: "invalid" }, 404);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("programme_briefings")
          .select("id,project_id,version,share_enabled,document")
          .eq("share_token", token)
          .maybeSingle();

        if (!row) return json({ state: "invalid" }, 404);
        if (!row.share_enabled) return json({ state: "revoked" }, 410);

        const doc = row.document as unknown as {
          preflight?: { ready: boolean }[];
          version: number;
        } | null;
        if (!doc) return json({ state: "invalid" }, 404);
        // A document that has not passed its provenance check is never served.
        if (!(doc.preflight ?? []).every((p) => p.ready)) return json({ state: "unavailable" }, 409);

        const { data: deckRow } = await supabaseAdmin
          .from("programme_decks")
          .select("version,deck")
          .eq("project_id", row.project_id as string)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        const deck = (deckRow?.deck ?? null) as unknown as {
          briefingVersion?: number;
          preflight?: { ready: boolean }[];
        } | null;

        const deckClean =
          !!deck &&
          deck.briefingVersion === (row.version as number) &&
          (deck.preflight ?? []).every((p) => p.ready);

        return json({
          state: "ok",
          briefing: doc,
          deck: deckClean ? deck : null,
        });
      },
    },
  },
});
