import { createFileRoute } from "@tanstack/react-router";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export const Route = createFileRoute("/api/upload-presentation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          const label = String(form.get("label") ?? "").trim();
          const thumbnail = form.get("thumbnail");
          const categoryRaw = String(form.get("category") ?? "presentations");
          const category = (categoryRaw === "brand" ? "brand" : "presentations") as
            | "presentations"
            | "brand";

          if (!(file instanceof File)) {
            return Response.json({ error: "Missing file" }, { status: 400 });
          }
          if (file.type !== "application/pdf") {
            return Response.json(
              { error: `Unsupported file type: ${file.type || "unknown"}` },
              { status: 400 },
            );
          }
          if (file.size > MAX_PDF_BYTES) {
            return Response.json(
              { error: "File exceeds 50 MB limit" },
              { status: 400 },
            );
          }
          if (!label) {
            return Response.json({ error: "Missing label" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Upload PDF
          const pdfPath = `${crypto.randomUUID()}.pdf`;
          const pdfBytes = new Uint8Array(await file.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage
            .from("presentations")
            .upload(pdfPath, pdfBytes, {
              contentType: "application/pdf",
              upsert: false,
            });
          if (upErr) {
            return Response.json({ error: upErr.message }, { status: 500 });
          }

          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from("presentations")
            .createSignedUrl(pdfPath, 60 * 60 * 24 * 365 * 10);
          if (signErr || !signed) {
            return Response.json(
              { error: signErr?.message || "Failed to sign URL" },
              { status: 500 },
            );
          }

          // Optional client-rendered thumbnail (page 1 PNG)
          let thumbUrl: string | null = null;
          let thumbStatus: "ready" | "pending" = "pending";
          if (thumbnail instanceof File && thumbnail.size > 0) {
            const thumbPath = `${crypto.randomUUID()}.png`;
            const thumbBytes = new Uint8Array(await thumbnail.arrayBuffer());
            const { error: tUpErr } = await supabaseAdmin.storage
              .from("thumbnails")
              .upload(thumbPath, thumbBytes, {
                contentType: "image/png",
                upsert: true,
                cacheControl: "31536000",
              });
            if (!tUpErr) {
              const { data: tSigned } = await supabaseAdmin.storage
                .from("thumbnails")
                .createSignedUrl(thumbPath, 60 * 60 * 24 * 365 * 10);
              if (tSigned) {
                thumbUrl = tSigned.signedUrl;
                thumbStatus = "ready";
              }
            }
          }

          // Determine next sort_order for the chosen category
          const { data: maxRow } = await supabaseAdmin
            .from("items")
            .select("sort_order")
            .eq("category", category)
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextOrder = (maxRow?.sort_order ?? 0) + 10;

          const { data: row, error: insErr } = await supabaseAdmin
            .from("items")
            .insert({
              category,
              label,
              url: signed.signedUrl,
              pdf_storage_path: pdfPath,
              sort_order: nextOrder,
              thumbnail_url: thumbUrl,
              thumbnail_status: thumbStatus,
              thumbnail_updated_at: thumbUrl ? new Date().toISOString() : null,
            })
            .select("*")
            .single();
          if (insErr) {
            return Response.json({ error: insErr.message }, { status: 500 });
          }
          return Response.json(row);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
