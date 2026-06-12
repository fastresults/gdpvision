import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CategoryBehavior = "website" | "pdf" | "docs" | "video";

export type Category = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  behavior: CategoryBehavior;
  is_builtin: boolean;
  sort_order: number;
};

// Curated lucide icon set the admin can pick from. Keep in sync with the
// ICON_MAP in kiosk-types.ts (icon-name -> lucide component).
export const CATEGORY_ICON_NAMES = [
  "Globe",
  "Presentation",
  "FileText",
  "Film",
  "Sparkles",
  "Building2",
  "Briefcase",
  "GraduationCap",
  "HeartPulse",
  "Leaf",
  "Anchor",
  "Zap",
  "Landmark",
  "Factory",
  "Ship",
  "Plane",
  "Cpu",
  "Wheat",
  "Banknote",
  "Hammer",
  "Lightbulb",
  "Network",
] as const;

const behaviorSchema = z.enum(["website", "pdf", "docs", "video"]);
const iconSchema = z.string().min(1).max(40);
const labelSchema = z.string().min(1).max(80);

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `cat-${Date.now().toString(36)}`
  );
}

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    icon: r.icon,
    behavior: r.behavior as CategoryBehavior,
    is_builtin: !!r.is_builtin,
    sort_order: r.sort_order,
  })) as Category[];
});

export const createCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        label: labelSchema,
        icon: iconSchema,
        behavior: behaviorSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let baseSlug = slugify(data.label);
    let slug = baseSlug;
    // Ensure unique slug
    for (let i = 2; i < 50; i++) {
      const { data: existing } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i}`;
    }
    const { data: maxRow } = await supabaseAdmin
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? 0) + 10;
    const { data: inserted, error } = await supabaseAdmin
      .from("categories")
      .insert({
        slug,
        label: data.label,
        icon: data.icon,
        behavior: data.behavior,
        is_builtin: false,
        sort_order: nextOrder,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id ?? null, slug: inserted?.slug ?? slug };
  });

export const updateCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: labelSchema.optional(),
        icon: iconSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { label?: string; icon?: string } = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("categories")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: e1 } = await supabaseAdmin
      .from("categories")
      .select("id, slug, is_builtin")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!row) throw new Error("Category not found");
    if (row.is_builtin) throw new Error("Built-in categories cannot be deleted");
    const { count, error: cErr } = await supabaseAdmin
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("category", row.slug);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        `This category still has ${count} item${count === 1 ? "" : "s"}. Remove them first.`,
      );
    }
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: e1 } = await supabaseAdmin
      .from("categories")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!current) throw new Error("Category not found");
    const q = supabaseAdmin.from("categories").select("*");
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
    const { error: e2 } = await supabaseAdmin
      .from("categories")
      .update({ sort_order: neighbor.sort_order })
      .eq("id", current.id);
    if (e2) throw new Error(e2.message);
    const { error: e3 } = await supabaseAdmin
      .from("categories")
      .update({ sort_order: current.sort_order })
      .eq("id", neighbor.id);
    if (e3) throw new Error(e3.message);
    return { ok: true };
  });
