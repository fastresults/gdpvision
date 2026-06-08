import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_SETTINGS = {
  admin_title: "GDP Vision Admin",
  kiosk_title: "GDP Vision",
  label_websites: "Websites",
  label_presentations: "Presentations",
  label_docs: "Google Docs",
  label_videos: "Past Events",
  label_brand: "Brand Building",
  idle_image_url: "",
};

const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

export const Route = createFileRoute("/api/kiosk-data")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [itemsResult, settingsResult, idleResult] = await Promise.all([
          supabaseAdmin
            .from("items")
            .select("*, favicon_asset:media_assets!items_favicon_asset_id_fkey(public_url)")
            .order("category", { ascending: true })
            .order("sort_order", { ascending: true }),
          supabaseAdmin.from("app_settings").select("key,value"),
          supabaseAdmin
            .from("idle_images")
            .select("*")
            .order("sort_order", { ascending: true }),
        ]);

        if (itemsResult.error) {
          return Response.json({ error: itemsResult.error.message }, { status: 500 });
        }
        if (settingsResult.error) {
          return Response.json({ error: settingsResult.error.message }, { status: 500 });
        }
        if (idleResult.error) {
          return Response.json({ error: idleResult.error.message }, { status: 500 });
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

        return Response.json(
          { items, settings, idleImages },
          { headers: { "Cache-Control": "private, max-age=5" } },
        );

      },
    },
  },
});