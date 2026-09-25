// @domain egov
// @tables egov_prd_share_links,egov_prds,app_settings
// @ui src/components/egov/SharePanel.tsx
//
// Read-only share links for an approved PRD (/e/$token). Same shape as
// investment share links: the token is shown once and only its hash is
// stored; links are flag-gated (public_prd_links_enabled, off by default),
// expire, can be capped by views, and can only be revoked, never edited.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/auth/require-admin";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { serverPublicOrigin } from "@/lib/personas/public-origin";
import { db, governanceError } from "@/lib/syndication/db";

import type { PrdShareLinkRow } from "./db";

export const PRD_LINKS_FLAG_KEY = "public_prd_links_enabled";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function readPrdLinksFlag(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", PRD_LINKS_FLAG_KEY)
    .maybeSingle();
  return (data?.value ?? "false").trim().toLowerCase() === "true";
}

async function resolveOrigin(): Promise<string> {
  let hint: string | null = null;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const origin = req?.headers.get("origin");
    if (origin && /^https?:\/\/[^/\s]+$/i.test(origin)) hint = origin;
    else if (req?.url) hint = new URL(req.url).origin;
  } catch {
    // No request context; fall back to configuration.
  }
  return serverPublicOrigin(hint);
}

/** The one place a PRD share link is spelled. */
export function prdLink(origin: string, token: string): string {
  return `${origin}/e/${token}`;
}

export type PrdLinkStatus = "active" | "expired" | "revoked" | "used_up";
export type PrdShareLinkView = Omit<PrdShareLinkRow, "token_hash"> & { status: PrdLinkStatus };

function linkStatus(l: PrdShareLinkRow, now = Date.now()): PrdLinkStatus {
  if (l.revoked_at) return "revoked";
  if (Date.parse(l.expires_at) <= now) return "expired";
  if (l.max_views != null && l.view_count >= l.max_views) return "used_up";
  return "active";
}

export const getPrdLinksEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [enabled, admin] = await Promise.all([
      readPrdLinksFlag(),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    return { enabled, canToggle: !!admin.data };
  });

export const setPrdLinksEnabled = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => parseInput(z.object({ enabled: z.boolean() }), d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert({
      key: PRD_LINKS_FLAG_KEY,
      value: data.enabled ? "true" : "false",
      updated_at: new Date().toISOString(),
    });
    if (error) throw governanceError(error);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: data.enabled ? "prd_links.enabled" : "prd_links.disabled",
      target_type: "app_settings",
      target_id: PRD_LINKS_FLAG_KEY,
      scope_key: null,
    });
    return { enabled: data.enabled };
  });

export const createPrdShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        prdId: z.string().uuid(),
        label: z.string().trim().min(2, "Say who the link is for.").max(120),
        expiresInDays: z.number().int().min(1).max(180).default(30),
        maxViews: z.number().int().positive().max(100000).nullable().optional(),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    if (!(await readPrdLinksFlag()))
      throw new Error(
        "Public PRD links are switched off for this installation. An administrator can switch them on.",
      );
    const origin = await resolveOrigin();
    const token = newToken();
    const token_hash = await sha256Hex(token);
    const expires_at = new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString();
    const { data: row, error } = await db(context.supabase)
      .from("egov_prd_share_links")
      .insert({
        prd_id: data.prdId,
        country_code: data.code,
        token_hash,
        token_hint: token.slice(-4),
        label: data.label,
        max_views: data.maxViews ?? null,
        expires_at,
      })
      .select("id,token_hint,label,expires_at")
      .single();
    if (error) throw governanceError(error);
    return {
      ...(row as Pick<PrdShareLinkRow, "id" | "token_hint" | "label" | "expires_at">),
      url: prdLink(origin, token),
    };
  });

export const listPrdShareLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, prdId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<PrdShareLinkView[]> => {
    const { data: rows, error } = await db(context.supabase)
      .from("egov_prd_share_links")
      .select(
        "id,prd_id,country_code,token_hint,label,max_views,view_count,last_viewed_at,expires_at,revoked_at,revoked_by,created_by,created_at",
      )
      .eq("prd_id", data.prdId)
      .eq("country_code", data.code)
      .order("created_at", { ascending: false });
    if (error) throw governanceError(error);
    const now = Date.now();
    return ((rows ?? []) as PrdShareLinkRow[]).map((l) => ({ ...l, status: linkStatus(l, now) }));
  });

export const revokePrdShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, id: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db(context.supabase)
      .from("egov_prd_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("country_code", data.code)
      .select("id,revoked_at")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("Only a PRD approver can revoke a link.");
    return row as { id: string; revoked_at: string };
  });
