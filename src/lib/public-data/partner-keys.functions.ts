// @domain public-data
// @tables partner_api_keys
// @ui src/routes/_authenticated/admin/partner-keys.tsx
//
// Admin-only management of partner keys (e.g. GDP Advisor) for /api/public/v2.
// The key is shown once on creation; only its hash is stored. RLS: admin role.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { API_SCOPES } from "@/lib/egov/api-keys.functions";
import { db } from "@/lib/syndication/db";

export interface PartnerKeyRow {
  id: string;
  partner: string;
  label: string;
  key_hint: string;
  countries: string[];
  scopes: string[];
  allowed_origins: string[];
  expires_at: string;
  last_used_at: string | null;
  request_count: number;
  revoked_at: string | null;
  created_at: string;
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const listPartnerKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerKeyRow[]> => {
    const { data, error } = await db(context.supabase)
      .from("partner_api_keys")
      .select("id,partner,label,key_hint,countries,scopes,allowed_origins,expires_at,last_used_at,request_count,revoked_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PartnerKeyRow[];
  });

export const createPartnerKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        partner: z.string().trim().min(2).max(80),
        label: z.string().trim().min(2).max(120),
        countries: z.array(z.string().trim().toUpperCase().regex(/^(\*|[A-Z]{2,4})$/)).min(1).max(60),
        scopes: z.array(z.enum(API_SCOPES)).min(1),
        allowedOrigins: z.array(z.string().trim().url().max(200)).max(10).default([]),
        expiresInDays: z.number().int().min(1).max(730).default(365),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const key = `gdpp_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    const { data: row, error } = await db(context.supabase)
      .from("partner_api_keys")
      .insert({
        partner: data.partner,
        label: data.label,
        key_hash: await sha256Hex(key),
        key_hint: key.slice(-4),
        countries: data.countries.includes("*") ? ["*"] : Array.from(new Set(data.countries)),
        scopes: Array.from(new Set(data.scopes)),
        allowed_origins: data.allowedOrigins.map((o) => new URL(o).origin),
        expires_at: new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message.includes("row-level") ? "Only admins can create partner keys." : error.message);
    return { id: (row as { id: string }).id, key };
  });

export const revokePartnerKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db(context.supabase)
      .from("partner_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Only admins can revoke partner keys.");
    return { ok: true };
  });
