import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_SETTINGS = {
  admin_title: "GDP Vision Admin",
  kiosk_title: "GDP Vision",
  idle_image_url: "",
};

const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

export const Route = createFileRoute("/kiosk/api/kiosk-data")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [itemsResult, settingsResult, idleResult, categoriesResult, galleriesResult, galleryItemsResult] =
          await Promise.all([
            supabaseAdmin
              .from("items")
              .select("*, favicon_asset:media_assets!items_favicon_asset_id_fkey(public_url)")
              .order("category", { ascending: true })
              .order("sort_order", { ascending: true }),
            supabaseAdmin.from("app_settings").select("key,value"),
            supabaseAdmin.from("idle_images").select("*").order("sort_order", { ascending: true }),
            supabaseAdmin.from("categories").select("*").order("sort_order", { ascending: true }),
            supabaseAdmin.from("galleries").select("*").order("sort_order", { ascending: true }),
            supabaseAdmin.from("gallery_items").select("*").order("sort_order", { ascending: true }),
          ]);

        for (const r of [itemsResult, settingsResult, idleResult, categoriesResult, galleriesResult, galleryItemsResult]) {
          if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
        }

        const settings = { ...DEFAULT_SETTINGS };
        for (const row of settingsResult.data ?? []) {
          if (SETTING_KEYS.has(row.key)) {
            settings[row.key as keyof typeof DEFAULT_SETTINGS] = row.value;
          }
        }

        const items = (itemsResult.data ?? []).map((row: any) => ({
          id: row.id,
          category: row.category,
          label: row.label,
          url: row.url,
          favicon_url: row.favicon_url,
          favicon_asset_id: row.favicon_asset_id,
          favicon_asset_url: row.favicon_asset?.public_url ?? null,
          thumbnail_url: row.thumbnail_url ?? null,
          thumbnail_status: row.thumbnail_status ?? "pending",
          thumbnail_error: row.thumbnail_error ?? null,
          thumbnail_updated_at: row.thumbnail_updated_at ?? null,
          pdf_storage_path: row.pdf_storage_path ?? null,
          tooltip: row.tooltip ?? null,
          sort_order: row.sort_order,
          created_at: row.created_at,
        }));

        const idleImages = (idleResult.data ?? []).map((row: any) => ({
          id: row.id,
          media_asset_id: row.media_asset_id,
          image_url: row.image_url,
          caption: row.caption,
          sort_order: row.sort_order,
          created_at: row.created_at,
        }));

        const categories = (categoriesResult.data ?? []).map((row: any) => ({
          id: row.id,
          slug: row.slug,
          label: row.label,
          icon: row.icon,
          behavior: row.behavior,
          is_builtin: !!row.is_builtin,
          sort_order: row.sort_order,
          media_modes: row.media_modes ?? [],
        }));

        const galleries = (galleriesResult.data ?? []).map((row: any) => ({
          id: row.id,
          category_id: row.category_id,
          label: row.label,
          cover_url: row.cover_url,
          sort_order: row.sort_order,
        }));

        const galleryItems = (galleryItemsResult.data ?? []).map((row: any) => ({
          id: row.id,
          gallery_id: row.gallery_id,
          kind: row.kind,
          media_asset_id: row.media_asset_id,
          storage_path: row.storage_path,
          thumbnail_url: row.thumbnail_url,
          label: row.label,
          sort_order: row.sort_order,
        }));

        return Response.json(
          { items, settings, idleImages, categories, galleries, galleryItems },
          { headers: { "Cache-Control": "private, max-age=5" } },
        );
      },
    },
  },
});
