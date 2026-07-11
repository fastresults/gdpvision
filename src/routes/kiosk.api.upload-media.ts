import { createFileRoute } from "@tanstack/react-router";

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const PDF_MIMES = ["application/pdf"];
const DOC_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const MAX_IMAGE = 50 * 1024 * 1024;
const MAX_DOC = 50 * 1024 * 1024;
const MAX_VIDEO = 500 * 1024 * 1024;

type Kind = "image" | "video" | "pdf" | "document";
function classify(mime: string): { kind: Kind; max: number } | null {
  if (IMAGE_MIMES.includes(mime)) return { kind: "image", max: MAX_IMAGE };
  if (VIDEO_MIMES.includes(mime)) return { kind: "video", max: MAX_VIDEO };
  if (PDF_MIMES.includes(mime)) return { kind: "pdf", max: MAX_DOC };
  if (DOC_MIMES.includes(mime)) return { kind: "document", max: MAX_DOC };
  return null;
}

export const Route = createFileRoute("/kiosk/api/upload-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return Response.json({ error: "Missing file" }, { status: 400 });
          }
          const c = classify(file.type);
          if (!c) {
            return Response.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
          }
          if (file.size > c.max) {
            return Response.json({ error: `File exceeds size limit for ${c.kind}` }, { status: 400 });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const ext = file.name.split(".").pop() || "bin";
          const storagePath = `${crypto.randomUUID()}.${ext}`;
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage
            .from("media-library")
            .upload(storagePath, bytes, { contentType: file.type, upsert: false });
          if (upErr) return Response.json({ error: upErr.message }, { status: 500 });
          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from("media-library")
            .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
          if (signErr || !signed) {
            return Response.json({ error: signErr?.message || "Failed to sign URL" }, { status: 500 });
          }
          const { data: row, error: insErr } = await supabaseAdmin
            .from("media_assets")
            .insert({
              filename: file.name,
              mime_type: file.type,
              size_bytes: file.size,
              storage_path: storagePath,
              public_url: signed.signedUrl,
              kind: c.kind,
            })
            .select("*")
            .single();
          if (insErr) return Response.json({ error: insErr.message }, { status: 500 });
          return Response.json(row);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
