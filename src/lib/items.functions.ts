import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ItemCategory = "websites" | "presentations" | "docs";

export type Item = {
  id: string;
  category: ItemCategory;
  label: string;
  url: string;
  favicon_url: string | null;
  sort_order: number;
  created_at: string;
};

const categorySchema = z.enum(["websites", "presentations", "docs"]);

export const listItems = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("items")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
});

export const createItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        category: categorySchema,
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
    const { data: maxRow } = await supabaseAdmin
      .from("items")
      .select("sort_order")
      .eq("category", data.category)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? 0) + 10;
    const { error } = await supabaseAdmin.from("items").insert({
      category: data.category,
      label: data.label,
      url: data.url,
      favicon_url: favicon,
      sort_order: nextOrder,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
    const { error } = await supabaseAdmin
      .from("items")
      .update({
        label: data.label,
        url: data.url,
        favicon_url: data.favicon_url ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
