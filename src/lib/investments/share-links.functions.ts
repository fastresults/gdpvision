// @domain investments
// @tables investment_share_links,investment_share_views,app_settings
// @ui src/routes/_authenticated/admin/countries.$code.investments.$id.tsx
//
// Share links for approved projects — the authenticated side. The public page
// that serves a link is in public-project.functions.ts.
//
// A link's token is 32 random bytes (base64url, 43 characters). Only its
// SHA-256 hash and last four characters are stored, so the full URL is shown
// exactly once, when the link is created. The database only lets investment
// approvers create or revoke links, only for approved projects, and a link can
// never be edited — only revoked.
//
// LINK ORIGIN AND PATH: links are spelled `${origin}/i/${token}` ("i" for
// investor). /p/$token was already taken by the persona presentation room.
// The origin goes through serverPublicOrigin() in src/lib/personas/public-origin.ts,
// the one place the app resolves addresses handed to the public: the
// PUBLIC_SITE_URL environment variable first, then the origin of the request
// that created the link (Origin header, else the request URL), then
// https://gdpvision.com. Login-gated Lovable preview hosts are always skipped,
// because an investor could not open a link on one.
//
// FEATURE FLAG: app setting "public_project_links_enabled" ("true"/"false",
// default false). Off means no new links and every existing link shows
// "not available".

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/auth/require-admin";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { serverPublicOrigin } from "@/lib/personas/public-origin";
import {
  db,
  governanceError,
  PACKAGE_KINDS,
  type PackageKind,
  type ShareLinkRow,
  type ShareViewRow,
} from "@/lib/syndication/db";

export const LINKS_FLAG_KEY = "public_project_links_enabled";
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export async function sha256Hex(s: string): Promise<string> {
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

/** Reads the feature flag with the service role; app_settings is not readable by every user. */
export async function readLinksFlag(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", LINKS_FLAG_KEY)
    .maybeSingle();
  return (data?.value ?? "false").trim().toLowerCase() === "true";
}

/** The public origin for a new link. See LINK ORIGIN above. */
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

/** The one place an investor share link is spelled. */
export function investorLink(origin: string, token: string): string {
  return `${origin}/i/${token}`;
}

export type ShareLinkStatus = "active" | "expired" | "revoked" | "used_up";

export type ShareLinkView = Omit<ShareLinkRow, "token_hash"> & {
  status: ShareLinkStatus;
  stats: {
    views: number;
    visitors: number;
    packageOpens: number;
    interests: number;
    lastViewedAt: string | null;
  };
};

function linkStatus(l: ShareLinkRow, now = Date.now()): ShareLinkStatus {
  if (l.revoked_at) return "revoked";
  if (Date.parse(l.expires_at) <= now) return "expired";
  if (l.max_views != null && l.view_count >= l.max_views) return "used_up";
  return "active";
}

export const getLinksEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [enabled, admin] = await Promise.all([
      readLinksFlag(),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    return { enabled, canToggle: !!admin.data };
  });

export const setLinksEnabled = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => parseInput(z.object({ enabled: z.boolean() }), d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert({
      key: LINKS_FLAG_KEY,
      value: data.enabled ? "true" : "false",
      updated_at: new Date().toISOString(),
    });
    if (error) throw governanceError(error);
    // A platform-wide switch that exposes project data publicly: always on the record.
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: data.enabled ? "share_links.enabled" : "share_links.disabled",
      target_type: "app_settings",
      target_id: LINKS_FLAG_KEY,
      scope_key: null,
    });
    return { enabled: data.enabled };
  });

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        projectId: z.string().uuid(),
        label: z
          .string()
          .trim()
          .min(2, 'Say who the link is for, e.g. "IFC infrastructure desk".')
          .max(120),
        expiresInDays: z
          .number()
          .int()
          .min(1, "A link lasts between 1 and 180 days.")
          .max(180, "A link lasts between 1 and 180 days.")
          .default(30),
        maxViews: z
          .number()
          .int()
          .positive("The view limit must be a whole number above zero.")
          .max(100000)
          .nullable()
          .optional(),
        allowInterest: z.boolean().default(true),
        includePackages: z
          .array(z.enum(PACKAGE_KINDS))
          .max(PACKAGE_KINDS.length)
          .default(["teaser"]),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    if (!(await readLinksFlag())) {
      throw new Error(
        "Public project links are switched off for this installation. An administrator can switch them on.",
      );
    }
    const origin = await resolveOrigin();
    const token = newToken();
    const token_hash = await sha256Hex(token);
    const expires_at = new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString();
    const include_packages = Array.from(new Set<PackageKind>(data.includePackages));

    const { data: row, error } = await db(context.supabase)
      .from("investment_share_links")
      .insert({
        project_id: data.projectId,
        country_code: data.code,
        token_hash,
        token_hint: token.slice(-4),
        label: data.label,
        allow_interest: data.allowInterest,
        include_packages,
        max_views: data.maxViews ?? null,
        expires_at,
      })
      .select("id,token_hint,label,expires_at")
      .single();
    if (error) throw governanceError(error);
    // The only time the token leaves the server.
    return {
      ...(row as Pick<ShareLinkRow, "id" | "token_hint" | "label" | "expires_at">),
      url: investorLink(origin, token),
    };
  });

export const listShareLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, projectId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const { data: rows, error } = await c
      .from("investment_share_links")
      .select(
        "id,project_id,country_code,token_hint,label,allow_interest,include_packages,max_views,view_count,last_viewed_at,expires_at,revoked_at,revoked_by,created_by,created_at",
      )
      .eq("project_id", data.projectId)
      .eq("country_code", data.code)
      .order("created_at", { ascending: false });
    if (error) throw governanceError(error);
    const links = (rows ?? []) as ShareLinkRow[];
    const ids = links.map((l) => l.id);
    const views: Array<Pick<ShareViewRow, "link_id" | "event" | "visitor_hash" | "viewed_at">> = [];
    if (ids.length) {
      const { data: v, error: ve } = await c
        .from("investment_share_views")
        .select("link_id,event,visitor_hash,viewed_at")
        .in("link_id", ids)
        .order("viewed_at", { ascending: false })
        .limit(5000);
      if (ve) throw governanceError(ve);
      views.push(...((v ?? []) as typeof views));
    }
    const now = Date.now();
    const out: ShareLinkView[] = links.map((l) => {
      const mine = views.filter((v) => v.link_id === l.id);
      const visitors = new Set(
        mine.filter((v) => v.event === "view" && v.visitor_hash).map((v) => v.visitor_hash),
      );
      return {
        ...l,
        status: linkStatus(l, now),
        stats: {
          views: mine.filter((v) => v.event === "view").length,
          visitors: visitors.size,
          packageOpens: mine.filter((v) => v.event === "package_open").length,
          interests: mine.filter((v) => v.event === "interest").length,
          lastViewedAt: l.last_viewed_at ?? mine.find((v) => v.event === "view")?.viewed_at ?? null,
        },
      };
    });
    return out;
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, id: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db(context.supabase)
      .from("investment_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("country_code", data.code)
      .select("id,revoked_at")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("Only an investment approver can revoke a link.");
    return row as { id: string; revoked_at: string };
  });
