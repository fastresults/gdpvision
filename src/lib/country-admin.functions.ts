// @domain core
// @tables audit_log,countries,country_access_requests,country_sectors,instance_bindings,ministries,profiles,sectors,user_roles
// @ui src/routes/_authenticated/admin/country.$code.tsx; src/routes/_authenticated/agency.index.tsx; src/routes/_authenticated/concierge.index.tsx

// Country-scoped admin + onboarding server functions.
// - getMyCountryStatus / requestCountryAccess: signed-in user flow.
// - listMyAdminScopes: which countries the caller can administer.
// - listCountryAccessRequests / decideCountryAccessRequest: country admin queue.
// - listCountryUsers / setCountryRole / removeCountryBinding: user management for a country.
// - grantCountryAdmin / revokeCountryAdmin: super-admin promotion of a country admin.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COUNTRY_ADMIN = "country_admin" as const;
const BASE_ROLE_ON_APPROVAL = "advisor" as const;

async function isGlobalAdmin(ctx: { supabase: any; userId: string }): Promise<boolean> {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  return Boolean(data);
}

async function isCountryAdmin(
  ctx: { supabase: any; userId: string },
  countryCode: string,
): Promise<boolean> {
  const { data } = await ctx.supabase.rpc("has_country_role", {
    _user_id: ctx.userId,
    _role: COUNTRY_ADMIN,
    _country_code: countryCode,
  });
  return Boolean(data);
}

async function assertCountryAdmin(
  ctx: { supabase: any; userId: string },
  countryCode: string,
) {
  if (!(await isCountryAdmin(ctx, countryCode))) {
    throw new Error("Forbidden: country admin only");
  }
}

// ─── Signed-in user: onboarding status ────────────────────────────────────────

export interface MyCountryStatus {
  bindings: Array<{ country_code: string; is_default: boolean; name: string | null }>;
  pendingRequests: Array<{ id: string; country_code: string; created_at: string; name: string | null }>;
  isGlobalAdmin: boolean;
  adminScopes: string[]; // country codes user can administer (empty if only super)
}

export const getMyCountryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyCountryStatus> => {
    const { supabase, userId } = context;

    const [bindingsRes, requestsRes, superRes, adminRolesRes] = await Promise.all([
      supabase
        .from("instance_bindings")
        .select("country_code,is_default,countries(name)")
        .eq("user_id", userId),
      supabase
        .from("country_access_requests")
        .select("id,country_code,created_at,countries(name)")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase
        .from("user_roles")
        .select("country_code")
        .eq("user_id", userId)
        .eq("role", COUNTRY_ADMIN),
    ]);

    if (bindingsRes.error) throw new Error(bindingsRes.error.message);
    if (requestsRes.error) throw new Error(requestsRes.error.message);
    if (adminRolesRes.error) throw new Error(adminRolesRes.error.message);

    return {
      bindings: (bindingsRes.data ?? []).map((b: any) => ({
        country_code: b.country_code,
        is_default: b.is_default,
        name: (b.countries as { name: string } | null)?.name ?? null,
      })),
      pendingRequests: (requestsRes.data ?? []).map((r: any) => ({
        id: r.id,
        country_code: r.country_code,
        created_at: r.created_at,
        name: (r.countries as { name: string } | null)?.name ?? null,
      })),
      isGlobalAdmin: Boolean(superRes.data),
      adminScopes: ((adminRolesRes.data ?? []) as Array<{ country_code: string | null }>)
        .map((r) => r.country_code)
        .filter((c): c is string => Boolean(c)),
    };
  });

// ─── Signed-in user: request a country assignment ─────────────────────────────

const RequestInput = z.object({
  countryCode: z.string().min(3).max(4),
  requestedRole: z
    .enum(["advisor", "line_minister", "principal", "steward", "data_steward", "cabinet_secretary", "comms_director"])
    .default("advisor"),
  note: z.string().max(500).optional(),
});

export const requestCountryAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Super admin: self-approve — insert binding directly.
    if (await isGlobalAdmin(context)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("instance_bindings")
        .select("country_code,is_default")
        .eq("user_id", userId);
      const hasAny = (existing ?? []).length > 0;
      const { error } = await supabaseAdmin.from("instance_bindings").upsert(
        { user_id: userId, country_code: data.countryCode, is_default: !hasAny },
        { onConflict: "user_id,country_code" },
      );
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("audit_log").insert({
        actor_id: userId,
        action: "country.binding.self",
        target_type: "user",
        target_id: userId,
        scope_key: data.countryCode,
        metadata: { via: "super_admin_self_assign" } as any,
      });
      return { ok: true, autoApproved: true };
    }

    // Normal user: create a pending request. Unique index prevents dupes.
    const { error } = await supabase.from("country_access_requests").insert({
      user_id: userId,
      country_code: data.countryCode,
      requested_role: data.requestedRole,
      note: data.note ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true, autoApproved: false };
  });

// ─── Country admin: list requests & users for a country ───────────────────────

const CountryInput = z.object({ countryCode: z.string().min(3).max(4) });

export interface CountryAccessRequestRow {
  id: string;
  user_id: string;
  display_name: string | null;
  requested_role: string;
  note: string | null;
  status: string;
  created_at: string;
}

export const listCountryAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<CountryAccessRequestRow[]> => {
    await assertCountryAdmin(context, data.countryCode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("country_access_requests")
      .select("id,user_id,requested_role,note,status,created_at")
      .eq("country_code", data.countryCode)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let profiles: Array<{ id: string; display_name: string | null }> = [];
    if (userIds.length) {
      const { data: pf } = await supabaseAdmin.from("profiles").select("id,display_name").in("id", userIds);
      profiles = (pf as any) ?? [];
    }
    const pByI = new Map(profiles.map((p) => [p.id, p.display_name]));

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      display_name: pByI.get(r.user_id) ?? null,
      requested_role: r.requested_role,
      note: r.note,
      status: r.status,
      created_at: r.created_at,
    }));
  });

const DecideInput = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
});

export const decideCountryAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DecideInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("country_access_requests")
      .select("id,user_id,country_code,requested_role,status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error(`Request already ${req.status}`);

    await assertCountryAdmin(context, req.country_code);

    if (data.approve) {
      // Add binding (default true if user has no bindings yet)
      const { data: existing } = await supabaseAdmin
        .from("instance_bindings")
        .select("country_code")
        .eq("user_id", req.user_id);
      const isFirst = (existing ?? []).length === 0;
      const { error: bErr } = await supabaseAdmin.from("instance_bindings").upsert(
        { user_id: req.user_id, country_code: req.country_code, is_default: isFirst },
        { onConflict: "user_id,country_code" },
      );
      if (bErr) throw new Error(bErr.message);

      // Grant the requested role scoped to that country (base role fallback).
      const role = req.requested_role || BASE_ROLE_ON_APPROVAL;
      const { error: rErr } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: req.user_id, role, country_code: req.country_code },
        { onConflict: "user_id,role,country_code" },
      );
      if (rErr) throw new Error(rErr.message);
    }

    const { error: uErr } = await supabaseAdmin
      .from("country_access_requests")
      .update({
        status: data.approve ? "approved" : "denied",
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: data.approve ? "country.access.approved" : "country.access.denied",
      target_type: "user",
      target_id: req.user_id,
      scope_key: req.country_code,
      metadata: { requestId: req.id, requested_role: req.requested_role } as any,
    });

    return { ok: true };
  });

// ─── Country admin: users bound to their country ──────────────────────────────

export interface CountryUserRow {
  user_id: string;
  display_name: string | null;
  is_default: boolean;
  roles: string[]; // roles scoped to this country (or global)
}

export const listCountryUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<CountryUserRow[]> => {
    await assertCountryAdmin(context, data.countryCode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: binds, error: bErr } = await supabaseAdmin
      .from("instance_bindings")
      .select("user_id,is_default")
      .eq("country_code", data.countryCode);
    if (bErr) throw new Error(bErr.message);

    const userIds = (binds ?? []).map((b: any) => b.user_id);
    if (!userIds.length) return [];

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,display_name").in("id", userIds),
      supabaseAdmin
        .from("user_roles")
        .select("user_id,role,country_code")
        .in("user_id", userIds),
    ]);

    const pByI = new Map(((profiles as any) ?? []).map((p: any) => [p.id, p.display_name]));
    const rByU = new Map<string, string[]>();
    for (const r of (roles as any) ?? []) {
      if (r.country_code && r.country_code !== data.countryCode) continue;
      const arr = rByU.get(r.user_id) ?? [];
      arr.push(r.role);
      rByU.set(r.user_id, arr);
    }

    return (binds ?? []).map((b: any) => ({
      user_id: b.user_id,
      display_name: (pByI.get(b.user_id) as string | null) ?? null,
      is_default: b.is_default,
      roles: rByU.get(b.user_id) ?? [],
    }));
  });

const CountryRoleInput = z.object({
  countryCode: z.string().min(3).max(4),
  userId: z.string().uuid(),
  role: z.enum([
    "advisor",
    "line_minister",
    "principal",
    "steward",
    "data_steward",
    "cabinet_secretary",
    "comms_director",
    "country_admin",
  ]),
  grant: z.boolean(),
});

export const setCountryRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    // Only super admin can grant/revoke country_admin — country admins cannot
    // create peers or promote themselves.
    if (data.role === "country_admin") {
      if (!(await isGlobalAdmin(context))) throw new Error("Forbidden: super admin only");
    } else {
      await assertCountryAdmin(context, data.countryCode);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.grant) {
      const { error } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.userId, role: data.role, country_code: data.countryCode },
        { onConflict: "user_id,role,country_code" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role)
        .eq("country_code", data.countryCode);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: data.grant ? "country.role.granted" : "country.role.revoked",
      target_type: "user",
      target_id: data.userId,
      scope_key: data.countryCode,
      metadata: { role: data.role } as any,
    });

    return { ok: true };
  });

const RemoveBindingInput = z.object({
  countryCode: z.string().min(3).max(4),
  userId: z.string().uuid(),
});

export const removeCountryBinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RemoveBindingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCountryAdmin(context, data.countryCode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("instance_bindings")
      .delete()
      .eq("user_id", data.userId)
      .eq("country_code", data.countryCode);
    if (error) throw new Error(error.message);

    // Also strip country-scoped roles for that country.
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("country_code", data.countryCode);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "country.binding.removed",
      target_type: "user",
      target_id: data.userId,
      scope_key: data.countryCode,
      metadata: {} as any,
    });

    return { ok: true };
  });

// ─── Country admin overview (for /admin/country/$code loader) ─────────────────

export interface CountryAdminOverview {
  country: {
    code: string;
    name: string;
    currency: string;
    gdp_current_usd: number | null;
    gdp_year: number | null;
  };
  sectorComposition: Array<{ sector_code: string; share_pct: number; confidence_grade: string }>;
  sectorCatalog: Array<{ code: string; name: string }>;
  ministries: Array<{ id: string; slug: string; name: string; sort_order: number }>;
  pendingCount: number;
  userCount: number;
}

export const getCountryAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<CountryAdminOverview> => {
    await assertCountryAdmin(context, data.countryCode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [countryRes, compRes, sectorsRes, ministriesRes, pendingRes, bindsRes] = await Promise.all([
      supabaseAdmin
        .from("countries")
        .select("code,name,currency,gdp_current_usd,gdp_year")
        .eq("code", data.countryCode)
        .maybeSingle(),
      supabaseAdmin
        .from("country_sectors")
        .select("sector_code,share_pct,confidence_grade")
        .eq("country_code", data.countryCode),
      supabaseAdmin.from("sectors").select("code,name").order("name"),
      supabaseAdmin
        .from("ministries")
        .select("id,slug,name,sort_order")
        .eq("country_code", data.countryCode)
        .order("sort_order"),
      supabaseAdmin
        .from("country_access_requests")
        .select("id", { count: "exact", head: true })
        .eq("country_code", data.countryCode)
        .eq("status", "pending"),
      supabaseAdmin
        .from("instance_bindings")
        .select("user_id", { count: "exact", head: true })
        .eq("country_code", data.countryCode),
    ]);

    if (countryRes.error) throw new Error(countryRes.error.message);
    if (!countryRes.data) throw new Error(`Country ${data.countryCode} not found`);

    return {
      country: {
        code: countryRes.data.code,
        name: countryRes.data.name,
        currency: countryRes.data.currency,
        gdp_current_usd: countryRes.data.gdp_current_usd !== null ? Number(countryRes.data.gdp_current_usd) : null,
        gdp_year: countryRes.data.gdp_year ?? null,
      },
      sectorComposition: (compRes.data ?? []).map((r: any) => ({
        sector_code: r.sector_code,
        share_pct: Number(r.share_pct),
        confidence_grade: r.confidence_grade,
      })),
      sectorCatalog: (sectorsRes.data ?? []).map((s: any) => ({ code: s.code, name: s.name })),
      ministries: (ministriesRes.data ?? []).map((m: any) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        sort_order: m.sort_order,
      })),
      pendingCount: pendingRes.count ?? 0,
      userCount: bindsRes.count ?? 0,
    };
  });

// ─── Seeding writes: GDP + sector composition + ministries ────────────────────

const GdpInput = z.object({
  countryCode: z.string().min(3).max(4),
  gdpCurrentUsd: z.number().nonnegative().nullable(),
  gdpYear: z.number().int().min(1990).max(2100).nullable(),
});

export const setCountryGdp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GdpInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCountryAdmin(context, data.countryCode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("countries")
      .update({
        gdp_current_usd: data.gdpCurrentUsd,
        gdp_year: data.gdpYear,
        updated_at: new Date().toISOString(),
      })
      .eq("code", data.countryCode);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "country.gdp.set",
      target_type: "country",
      target_id: data.countryCode,
      metadata: { gdp_current_usd: data.gdpCurrentUsd, gdp_year: data.gdpYear } as any,
    });
    return { ok: true };
  });

const CompositionInput = z.object({
  countryCode: z.string().min(3).max(4),
  rows: z
    .array(
      z.object({
        sector_code: z.string().min(2).max(64),
        share_pct: z.number().min(0).max(100),
        confidence_grade: z.enum(["A", "B", "C", "D"]).default("C"),
      }),
    )
    .max(64),
});

export const saveSectorComposition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CompositionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCountryAdmin(context, data.countryCode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Replace-all semantics: delete then insert.
    const { error: dErr } = await supabaseAdmin
      .from("country_sectors")
      .delete()
      .eq("country_code", data.countryCode);
    if (dErr) throw new Error(dErr.message);

    if (data.rows.length) {
      const { error: iErr } = await supabaseAdmin.from("country_sectors").insert(
        data.rows.map((r) => ({
          country_code: data.countryCode,
          sector_code: r.sector_code,
          share_pct: r.share_pct,
          confidence_grade: r.confidence_grade,
        })),
      );
      if (iErr) throw new Error(iErr.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "country.composition.saved",
      target_type: "country",
      target_id: data.countryCode,
      metadata: { count: data.rows.length } as any,
    });

    return { ok: true, count: data.rows.length };
  });

const MinistryInput = z.object({
  countryCode: z.string().min(3).max(4),
  ministries: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        slug: z.string().min(1).max(64),
        name: z.string().min(1).max(160),
        sort_order: z.number().int().min(0).max(999).default(0),
      }),
    )
    .max(40),
});

export const saveMinistries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MinistryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCountryAdmin(context, data.countryCode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const keptIds = data.ministries.filter((m) => m.id).map((m) => m.id!) as string[];

    // Delete ministries in this country not in the kept set.
    let del = supabaseAdmin.from("ministries").delete().eq("country_code", data.countryCode);
    if (keptIds.length) del = del.not("id", "in", `(${keptIds.join(",")})`);
    const { error: dErr } = await del;
    if (dErr) throw new Error(dErr.message);

    // Upsert the rest.
    if (data.ministries.length) {
      const rows = data.ministries.map((m) => ({
        id: m.id,
        country_code: data.countryCode,
        slug: m.slug,
        name: m.name,
        sort_order: m.sort_order,
        updated_at: new Date().toISOString(),
      }));
      const { error: uErr } = await supabaseAdmin.from("ministries").upsert(rows, { onConflict: "id" });
      if (uErr) throw new Error(uErr.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "country.ministries.saved",
      target_type: "country",
      target_id: data.countryCode,
      metadata: { count: data.ministries.length } as any,
    });

    return { ok: true, count: data.ministries.length };
  });
