import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Gallery, GalleryItem, MediaMode } from "./kiosk-types";

export type { Gallery, GalleryItem };

const kindSchema = z.enum(["video", "image"]);

export const listGalleries = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ categoryId: z.string().uuid().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("galleries").select("*").order("sort_order", { ascending: true });
    if (data?.categoryId) q = q.eq("category_id", data.categoryId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Gallery[];
  });

export const listAllGalleryItems = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("gallery_items")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GalleryItem[];
});

export const createGallery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        categoryId: z.string().uuid(),
        label: z.string().min(1).max(120),
        coverUrl: z.string().max(2048).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin
      .from("galleries")
      .select("sort_order")
      .eq("category_id", data.categoryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = (maxRow?.sort_order ?? 0) + 10;
    const { data: row, error } = await supabaseAdmin
      .from("galleries")
      .insert({
        category_id: data.categoryId,
        label: data.label,
        cover_url: data.coverUrl ?? null,
        sort_order,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Gallery;
  });

export const updateGallery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().min(1).max(120).optional(),
        coverUrl: z.string().max(2048).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.coverUrl !== undefined) patch.cover_url = data.coverUrl;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("galleries").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGallery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("galleries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveGallery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("galleries")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("Gallery not found");
    const base = supabaseAdmin
      .from("galleries")
      .select("*")
      .eq("category_id", (current as any).category_id);
    const { data: neighbor } =
      data.direction === "up"
        ? await base
            .lt("sort_order", (current as any).sort_order)
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle()
        : await base
            .gt("sort_order", (current as any).sort_order)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
    if (!neighbor) return { ok: true };
    await supabaseAdmin
      .from("galleries")
      .update({ sort_order: (neighbor as any).sort_order })
      .eq("id", (current as any).id);
    await supabaseAdmin
      .from("galleries")
      .update({ sort_order: (current as any).sort_order })
      .eq("id", (neighbor as any).id);
    return { ok: true };
  });

export const addGalleryItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        galleryId: z.string().uuid(),
        kind: kindSchema,
        mediaAssetId: z.string().uuid().nullable().optional(),
        storagePath: z.string().max(2048).nullable().optional(),
        thumbnailUrl: z.string().max(2048).nullable().optional(),
        label: z.string().max(255).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin
      .from("gallery_items")
      .select("sort_order")
      .eq("gallery_id", data.galleryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = (maxRow?.sort_order ?? 0) + 10;
    const { data: row, error } = await supabaseAdmin
      .from("gallery_items")
      .insert({
        gallery_id: data.galleryId,
        kind: data.kind,
        media_asset_id: data.mediaAssetId ?? null,
        storage_path: data.storagePath ?? null,
        thumbnail_url: data.thumbnailUrl ?? null,
        label: data.label ?? null,
        sort_order,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as GalleryItem;
  });

export const updateGalleryItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().max(255).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch.label = data.label;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("gallery_items").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGalleryItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gallery_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveGalleryItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("gallery_items")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("Item not found");
    const base = supabaseAdmin
      .from("gallery_items")
      .select("*")
      .eq("gallery_id", (current as any).gallery_id);
    const { data: neighbor } =
      data.direction === "up"
        ? await base
            .lt("sort_order", (current as any).sort_order)
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle()
        : await base
            .gt("sort_order", (current as any).sort_order)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
    if (!neighbor) return { ok: true };
    await supabaseAdmin
      .from("gallery_items")
      .update({ sort_order: (neighbor as any).sort_order })
      .eq("id", (current as any).id);
    await supabaseAdmin
      .from("gallery_items")
      .update({ sort_order: (current as any).sort_order })
      .eq("id", (neighbor as any).id);
    return { ok: true };
  });

export type MediaModeValue = MediaMode;
