// Invitation-only signup server functions.
// - Admins create/list/revoke invitations.
// - Anyone can look up a single invitation by opaque token.
// - Accept is called after a user is signed in; it marks the invitation
//   accepted and grants the assigned role via user_roles.
// - Access gate is checked on every authenticated entry to the app.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ROLES = [
  "admin",
  "cabinet_secretary",
  "principal",
  "line_minister",
  "advisor",
  "comms_director",
  "steward",
  "data_steward",
] as const;

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

function newToken(): string {
  // 32 bytes → 43-char urlsafe base64. Unguessable.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface InvitationRow {
  id: string;
  email: string;
  token: string;
  role: string;
  country_code: string | null;
  note: string | null;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ─── Admin: create ────────────────────────────────────────────────────────────
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    email: string;
    role?: (typeof APP_ROLES)[number];
    country_code?: string | null;
    note?: string | null;
    expires_in_days?: number;
  }) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        role: z.enum(APP_ROLES).default("line_minister"),
        country_code: z.string().trim().toUpperCase().length(3).nullish(),
        note: z.string().trim().max(500).nullish(),
        expires_in_days: z.number().int().min(1).max(365).default(30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<InvitationRow> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Revoke any prior open invite for this email to keep the unique index happy.
    await supabaseAdmin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .ilike("email", data.email)
      .is("accepted_at", null)
      .is("revoked_at", null);

    const token = newToken();
    const expires_at = new Date(
      Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: data.email,
        token,
        role: data.role,
        country_code: data.country_code ?? null,
        note: data.note ?? null,
        invited_by: context.userId,
        expires_at,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row as InvitationRow;
  });

// ─── Admin: list ──────────────────────────────────────────────────────────────
export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvitationRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as InvitationRow[];
  });

// ─── Admin: revoke ────────────────────────────────────────────────────────────
export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Public: look up by token (pre-signup) ────────────────────────────────────
export const getInvitationByToken = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().min(20).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabasePublic = createClient(
      process.env.SUPABASE_URL!,
      key,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) => {
            const h = new Headers(init?.headers);
            if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
              h.delete("Authorization");
            }
            h.set("apikey", key);
            return fetch(input, { ...init, headers: h });
          },
        },
      },
    );
    const { data: row, error } = await supabasePublic
      .from("invitations")
      .select("id,email,role,country_code,expires_at,accepted_at,revoked_at,note")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.revoked_at) return { ok: false as const, reason: "revoked" as const };
    if (row.accepted_at) return { ok: false as const, reason: "accepted" as const };
    if (new Date(row.expires_at).getTime() < Date.now())
      return { ok: false as const, reason: "expired" as const };
    return {
      ok: true as const,
      invitation: {
        email: row.email as string,
        role: row.role as string,
        country_code: row.country_code as string | null,
        note: row.note as string | null,
        expires_at: row.expires_at as string,
      },
    };
  });

// ─── Auth: accept (called after signIn/signUp on the invite page) ─────────────
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().min(20).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userEmail = (context.claims as any)?.email as string | undefined;
    if (!userEmail) throw new Error("No email on session");

    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation not found");
    if (inv.revoked_at) throw new Error("Invitation revoked");
    if (inv.accepted_at) throw new Error("Invitation already used");
    if (new Date(inv.expires_at).getTime() < Date.now())
      throw new Error("Invitation expired");
    if (String(inv.email).toLowerCase() !== userEmail.toLowerCase())
      throw new Error("Invitation email does not match signed-in email");

    // Grant role
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: context.userId,
          role: inv.role,
          country_code: inv.country_code,
        },
        { onConflict: "user_id,role,country_code" },
      );
    if (rErr) throw new Error(rErr.message);

    // Mark accepted
    const { error: aErr } = await supabaseAdmin
      .from("invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", inv.id);
    if (aErr) throw new Error(aErr.message);

    return { ok: true as const, role: inv.role, country_code: inv.country_code };
  });

// ─── Auth: gate check for _authenticated entry ────────────────────────────────
export const checkAccessAllowed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as any)?.email as string | undefined;
    const { data, error } = await context.supabase.rpc("access_allowed", {
      _user_id: context.userId,
      _email: email ?? null,
    });
    if (error) throw new Error(error.message);
    return { allowed: Boolean(data), email: email ?? null };
  });
