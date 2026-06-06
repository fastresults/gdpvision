import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MediaKind = "image" | "video" | "pdf" | "document";

export type MediaAsset = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  public_url: string;
  kind: MediaKind;
  created_at: string;
};

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

function classify(mime: string): { kind: MediaKind; max: number } | null {
  if (IMAGE_MIMES.includes(mime)) return { kind: "image", max: MAX_IMAGE };
  if (VIDEO_MIMES.includes(mime)) return { kind: "video", max: MAX_VIDEO };
  if (PDF_MIMES.includes(mime)) return { kind: "pdf", max: MAX_DOC };
  if (DOC_MIMES.includes(mime)) return { kind: "document", max: MAX_DOC };
  return null;
}

export const listMedia = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ kind: z.enum(["image", "video", "pdf", "document"]).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("media_assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (data?.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as MediaAsset[];
  });

export const uploadMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected FormData");
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    const c = classify(file.type);
    if (!c) throw new Error(`Unsupported file type: ${file.type}`);
    if (file.size > c.max) throw new Error(`File exceeds size limit for ${c.kind}`);
    return { file, kind: c.kind };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const file = data.file;
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage
      .from("media-library")
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("media-library")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
    if (signErr || !signed) throw new Error(signErr?.message || "Failed to sign URL");
    const { data: row, error: insErr } = await supabaseAdmin
      .from("media_assets")
      .insert({
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: storagePath,
        public_url: signed.signedUrl,
        kind: data.kind,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);
    return row as MediaAsset;
  });

export const renameMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), filename: z.string().min(1).max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("media_assets")
      .update({ filename: data.filename })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("media_assets")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (row?.storage_path) {
      await supabaseAdmin.storage.from("media-library").remove([row.storage_path]);
    }
    const { error } = await supabaseAdmin.from("media_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setItemFaviconAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        assetId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("items")
      .update({ favicon_asset_id: data.assetId })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
