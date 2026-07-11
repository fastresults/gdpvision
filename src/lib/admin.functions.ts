// Admin console server functions (PRD §12 Screen 18).
// Every handler verifies the caller is `admin` via has_role, then uses the
// service-role client (loaded inside the handler) to read/write across
// tables the caller's own RLS wouldn't allow.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["admin", "cabinet_secretary", "principal", "minister", "advisor", "comms_director", "operator", "data_steward"] as const;
type Role = (typeof ROLES)[number];

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export interface AdminUserRow {
  user_id: string;
  display_name: string | null;
  roles: Array<{ role: string; country_code: string | null }>;
  bindings: Array<{ country_code: string; is_default: boolean }>;
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: bindings, error: bErr }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id,display_name").order("display_name"),
        supabaseAdmin.from("user_roles").select("user_id,role,country_code"),
        supabaseAdmin.from("instance_bindings").select("user_id,country_code,is_default"),
      ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);
    if (bErr) throw new Error(bErr.message);

    const rolesBy = new Map<string, AdminUserRow["roles"]>();
    for (const r of roles ?? []) {
      const arr = rolesBy.get(r.user_id) ?? [];
      arr.push({ role: r.role as string, country_code: r.country_code });
      rolesBy.set(r.user_id, arr);
    }
    const bindsBy = new Map<string, AdminUserRow["bindings"]>();
    for (const b of bindings ?? []) {
      const arr = bindsBy.get(b.user_id) ?? [];
      arr.push({ country_code: b.country_code, is_default: b.is_default });
      bindsBy.set(b.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      user_id: p.id,
      display_name: p.display_name,
      roles: rolesBy.get(p.id) ?? [],
      bindings: bindsBy.get(p.id) ?? [],
    }));
  });

const GrantInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLES),
  countryCode: z.string().min(3).max(4).optional(),
});

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GrantInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: data.role as Role, country_code: data.countryCode ?? null },
        { onConflict: "user_id,role,country_code" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GrantInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    q = data.countryCode ? q.eq("country_code", data.countryCode) : q.is("country_code", null);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BindingInput = z.object({
  userId: z.string().uuid(),
  countryCode: z.string().min(3).max(4),
});

export const addBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BindingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("instance_bindings")
      .upsert({ user_id: data.userId, country_code: data.countryCode }, { onConflict: "user_id,country_code" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BindingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("instance_bindings")
      .delete()
      .eq("user_id", data.userId)
      .eq("country_code", data.countryCode);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BindingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: clearErr } = await supabaseAdmin
      .from("instance_bindings")
      .update({ is_default: false })
      .eq("user_id", data.userId);
    if (clearErr) throw new Error(clearErr.message);
    const { error: setErr } = await supabaseAdmin
      .from("instance_bindings")
      .update({ is_default: true })
      .eq("user_id", data.userId)
      .eq("country_code", data.countryCode);
    if (setErr) throw new Error(setErr.message);
    return { ok: true };
  });

export const listCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("countries")
      .select("code,name,currency,is_cbi_state")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
