// @domain mandate-compact
// @tables country_manifestos
// @ui src/components/mandate-compact/ManifestoCover.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "thumbnails";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export type ManifestoCoverInfo = {
  manifestoId: string;
  source: "uploaded" | "first_page" | "placeholder";
  url: string | null;
  title: string | null;
  electionCycle: string | null;
};

const GetInput = z.object({ manifestoIds: z.array(z.string().uuid()).max(50) });

export const getManifestoCovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => GetInput.parse(i))
  .handler(async ({ data, context }): Promise<ManifestoCoverInfo[]> => {
    if (!data.manifestoIds.length) return [];
    // RLS on country_manifestos decides which rows this user may see.
    const { data: rows, error } = await context.supabase
      .from("country_manifestos")
      .select("id, title, election_cycle, thumbnail_path, thumbnail_source")
      .in("id", data.manifestoIds);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return Promise.all(
      (rows ?? []).map(async (r) => {
        let url: string | null = null;
        if (r.thumbnail_path && r.thumbnail_source !== "placeholder") {
          const { data: s } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(r.thumbnail_path, 3600);
          url = s?.signedUrl ?? null;
        }
        return {
          manifestoId: r.id,
          source: r.thumbnail_source as ManifestoCoverInfo["source"],
          url,
          title: r.title,
          electionCycle: r.election_cycle,
        };
      }),
    );
  });

const UploadInput = z.object({
  manifestoId: z.string().uuid(),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  base64: z.string().min(10),
  source: z.enum(["uploaded", "first_page"]),
});

export const uploadManifestoThumbnail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UploadInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("country_manifestos")
      .select("id, country_code")
      .eq("id", data.manifestoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Manifesto not found");

    const [{ data: isAdmin }, { data: isCountryAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_country_role", { _user_id: userId, _role: "country_admin", _country_code: row.country_code }),
    ]);
    if (!isAdmin && !isCountryAdmin) throw new Error("Only administrators can change a manifesto cover.");

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > MAX_BYTES) throw new Error("Cover image must be 5 MB or smaller.");

    const path = `manifestos/${row.country_code}/${row.id}-${Date.now()}.${TYPES[data.contentType]}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (up.error) throw new Error(up.error.message);
    const upd = await supabaseAdmin
      .from("country_manifestos")
      .update({ thumbnail_path: path, thumbnail_source: data.source, thumbnail_updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true, path };
  });
