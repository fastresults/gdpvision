import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type IdleImage = {
  id: string;
  media_asset_id: string | null;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

export const listIdleImages = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("idle_images")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as IdleImage[];
});

export const addIdleImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        image_url: z.string().url().max(2000),
        media_asset_id: z.string().uuid().nullable().optional(),
        caption: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // prevent duplicates by url
    const { data: existing } = await supabaseAdmin
      .from("idle_images")
      .select("id")
      .eq("image_url", data.image_url)
      .maybeSingle();
    if (existing) return { ok: true, id: existing.id, duplicate: true };

    const { data: maxRow } = await supabaseAdmin
      .from("idle_images")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? 0) + 10;
    const { data: inserted, error } = await supabaseAdmin
      .from("idle_images")
      .insert({
        image_url: data.image_url,
        media_asset_id: data.media_asset_id ?? null,
        caption: data.caption ?? null,
        sort_order: nextOrder,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id ?? null };
  });

export const updateIdleImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        caption: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("idle_images")
      .update({ caption: data.caption ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeIdleImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("idle_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveIdleImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: e1 } = await supabaseAdmin
      .from("idle_images")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!current) throw new Error("Idle image not found");

    const q = supabaseAdmin.from("idle_images").select("*");
    const { data: neighbor } =
      data.direction === "up"
        ? await q
            .lt("sort_order", current.sort_order)
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle()
        : await q
            .gt("sort_order", current.sort_order)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
    if (!neighbor) return { ok: true };

    await supabaseAdmin
      .from("idle_images")
      .update({ sort_order: neighbor.sort_order })
      .eq("id", current.id);
    await supabaseAdmin
      .from("idle_images")
      .update({ sort_order: current.sort_order })
      .eq("id", neighbor.id);
    return { ok: true };
  });
