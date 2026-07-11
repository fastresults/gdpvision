import { createFileRoute } from "@tanstack/react-router";
import { blockMarketingRequest } from "@/lib/host-guard";

const PDF_PATH_PATTERN = /^[a-f0-9-]+\.pdf$/i;

export const Route = createFileRoute("/api/public/presentation-pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = blockMarketingRequest(request);
        if (blocked) return blocked;

        try {
          const url = new URL(request.url);
          const path = url.searchParams.get("path") ?? "";

          if (!PDF_PATH_PATTERN.test(path)) {
            return Response.json({ error: "Invalid PDF path" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage
            .from("presentations")
            .download(path);

          if (error || !data) {
            return Response.json(
              { error: error?.message || "PDF not found" },
              { status: 404 },
            );
          }

          const buf = await data.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Length": String(buf.byteLength),
              "Content-Disposition": `inline; filename="${path}"`,
              "Cache-Control": "private, max-age=300",
              "Accept-Ranges": "bytes",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Failed to load PDF";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});