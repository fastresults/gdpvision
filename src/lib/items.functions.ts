import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VIDEO_CATEGORIES, type Item, type ItemCategory, type ThumbnailStatus } from "./kiosk-types";

// Categories that should not be auto-screenshotted by mShots.
// Presentations are PDF uploads and generate their own thumbnail at upload time.
export const NO_AUTO_THUMBNAIL_CATEGORIES: ItemCategory[] = [
  "videos",
  "brand",
  "presentations",
];

export { VIDEO_CATEGORIES, type Item, type ItemCategory, type ThumbnailStatus };

const categorySchema = z.enum(["websites", "presentations", "docs", "videos", "brand"]);

const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export const uploadEventVideo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected FormData");
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    if (!ALLOWED_VIDEO_MIME.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error("File exceeds 500 MB limit");
    }
    return { file };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const file = data.file;
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from("event-videos")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("event-videos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed) throw new Error(signError?.message || "Failed to sign URL");
    return { publicUrl: signed.signedUrl };
  });

export const listItems = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("items")
    .select("*, favicon_asset:media_assets!items_favicon_asset_id_fkey(public_url)")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    category: r.category,
    label: r.label,
    url: r.url,
    favicon_url: r.favicon_url,
    favicon_asset_id: r.favicon_asset_id,
    favicon_asset_url: r.favicon_asset?.public_url ?? null,
    thumbnail_url: r.thumbnail_url ?? null,
    thumbnail_status: (r.thumbnail_status ?? "pending") as ThumbnailStatus,
    thumbnail_error: r.thumbnail_error ?? null,
    thumbnail_updated_at: r.thumbnail_updated_at ?? null,
    pdf_storage_path: r.pdf_storage_path ?? null,
    tooltip: r.tooltip ?? null,
    sort_order: r.sort_order,
    created_at: r.created_at,
  })) as Item[];
});

export const createItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        category: categorySchema,
        label: z.string().min(1).max(200),
        url: z.string().url().max(2000),
        favicon_url: z.string().max(2000).optional().nullable(),
        tooltip: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let favicon = data.favicon_url ?? null;
    if (!favicon && !VIDEO_CATEGORIES.includes(data.category)) {
      try {
        const host = new URL(data.url).hostname;
        favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
      } catch {
        // ignore
      }
    }
    const { data: maxRow } = await supabaseAdmin
      .from("items")
      .select("sort_order")
      .eq("category", data.category)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? 0) + 10;
    const { data: inserted, error } = await supabaseAdmin
      .from("items")
      .insert({
        category: data.category,
        label: data.label,
        url: data.url,
        favicon_url: favicon,
        tooltip: data.tooltip ?? null,
        sort_order: nextOrder,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id ?? null };
  });

export const updateItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().min(1).max(200),
        url: z.string().url().max(2000),
        favicon_url: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let favicon = data.favicon_url ?? null;
    if (!favicon) {
      try {
        const host = new URL(data.url).hostname;
        favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
      } catch {
        // ignore
      }
    }
    const { error } = await supabaseAdmin
      .from("items")
      .update({
        label: data.label,
        url: data.url,
        favicon_url: favicon,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshFavicons = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("items")
    .select("id, url, favicon_url");
  if (error) throw new Error(error.message);
  let updated = 0;
  for (const row of rows ?? []) {
    // Skip user-set custom favicons; recompute blanks and auto-generated google s2 URLs.
    const isAutoGenerated =
      !row.favicon_url ||
      row.favicon_url.startsWith("https://www.google.com/s2/favicons");
    if (!isAutoGenerated) continue;
    try {
      const host = new URL(row.url).hostname;
      const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
      if (favicon === row.favicon_url) continue;
      const { error: ue } = await supabaseAdmin
        .from("items")
        .update({ favicon_url: favicon })
        .eq("id", row.id);
      if (!ue) updated += 1;
    } catch {
      // skip invalid URLs
    }
  }
  return { ok: true, updated };
});

export const deleteItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look up the row so we can also remove any uploaded PDF object from storage.
    const { data: row } = await supabaseAdmin
      .from("items")
      .select("pdf_storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.pdf_storage_path) {
      await supabaseAdmin.storage.from("presentations").remove([row.pdf_storage_path]);
    }
    return { ok: true };
  });

export const moveItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: e1 } = await supabaseAdmin
      .from("items")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!current) throw new Error("Item not found");

    const baseQuery = supabaseAdmin
      .from("items")
      .select("*")
      .eq("category", current.category);
    const { data: neighbor } =
      data.direction === "up"
        ? await baseQuery
            .lt("sort_order", current.sort_order)
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle()
        : await baseQuery
            .gt("sort_order", current.sort_order)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
    if (!neighbor) return { ok: true };

    const { error: e2 } = await supabaseAdmin
      .from("items")
      .update({ sort_order: neighbor.sort_order })
      .eq("id", current.id);
    if (e2) throw new Error(e2.message);
    const { error: e3 } = await supabaseAdmin
      .from("items")
      .update({ sort_order: current.sort_order })
      .eq("id", neighbor.id);
    if (e3) throw new Error(e3.message);
    return { ok: true };
  });

// ----- Thumbnails (homepage screenshots) -----

const MSHOTS_W = 1200;
const MSHOTS_H = 750;
// mShots returns a small 400x300 placeholder PNG while it generates the real
// screenshot. Real screenshots are MUCH larger (typically >40KB) and at the
// requested dimensions. We use Content-Length + a few retries to detect the
// transition from placeholder to real image.
const PLACEHOLDER_MAX_BYTES = 8 * 1024; // placeholder is ~3-5KB
const MAX_POLL_ATTEMPTS = 8;
const POLL_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchScreenshotBytes(
  sourceUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const mshots = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(sourceUrl)}?w=${MSHOTS_W}&h=${MSHOTS_H}`;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(mshots, {
        redirect: "follow",
        headers: { "User-Agent": "GDPVision-Thumbnailer/1.0" },
      });
      if (!res.ok) {
        await sleep(POLL_DELAY_MS);
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (buf.byteLength > PLACEHOLDER_MAX_BYTES) {
        return { bytes: buf, contentType };
      }
    } catch {
      // network blip — retry
    }
    await sleep(POLL_DELAY_MS);
  }
  return null;
}

export const generateItemThumbnail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("items")
      .select("id, url, category, thumbnail_url")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Item not found");
    if (NO_AUTO_THUMBNAIL_CATEGORIES.includes(item.category as ItemCategory)) {
      return { ok: true, status: "skipped" as const };
    }

    await supabaseAdmin
      .from("items")
      .update({ thumbnail_status: "processing", thumbnail_error: null })
      .eq("id", item.id);

    try {
      const result = await fetchScreenshotBytes(item.url);
      if (!result) {
        await supabaseAdmin
          .from("items")
          .update({
            thumbnail_status: "failed",
            thumbnail_error: "Screenshot provider did not return a real image in time",
            thumbnail_updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        return { ok: false, status: "failed" as const };
      }

      const ext = result.contentType.includes("png") ? "png" : "jpg";
      const storagePath = `${item.id}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabaseAdmin.storage
        .from("thumbnails")
        .upload(storagePath, result.bytes, {
          contentType: result.contentType,
          upsert: true,
          cacheControl: "31536000",
        });
      if (upErr) throw new Error(upErr.message);

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("thumbnails")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed) throw new Error(signErr?.message || "Failed to sign URL");

      await supabaseAdmin
        .from("items")
        .update({
          thumbnail_url: signed.signedUrl,
          thumbnail_status: "ready",
          thumbnail_error: null,
          thumbnail_updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      return { ok: true, status: "ready" as const, url: signed.signedUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("items")
        .update({
          thumbnail_status: "failed",
          thumbnail_error: msg.slice(0, 500),
          thumbnail_updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      return { ok: false, status: "failed" as const, error: msg };
    }
  });

export const refreshAllThumbnails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ force: z.boolean().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) => {
    const force = data?.force ?? false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("items")
      .select("id, category, thumbnail_status");
    if (error) throw new Error(error.message);

    const targets = (rows ?? []).filter((r) => {
      if (NO_AUTO_THUMBNAIL_CATEGORIES.includes(r.category as ItemCategory)) return false;
      if (force) return true;
      return r.thumbnail_status !== "ready";
    });

    // Run in parallel; mShots is CDN-cached per URL so concurrency is fine.
    const results = await Promise.allSettled(
      targets.map(async (r) => {
        // Inline call to keep one network/storage path per item.
        const fn = generateItemThumbnail as unknown as (args: {
          data: { id: string };
        }) => Promise<{ ok: boolean }>;
        return fn({ data: { id: r.id } });
      }),
    );

    const ok = results.filter((x) => x.status === "fulfilled" && x.value.ok).length;
    const failed = results.length - ok;
    return { ok: true, processed: results.length, ready: ok, failed };
  });

