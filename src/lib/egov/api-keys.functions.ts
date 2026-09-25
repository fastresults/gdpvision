// @domain egov
// @tables egov_api_keys,egov_prds
// @ui src/components/egov/ConnectionPanel.tsx
//
// Keys a country's e-government platform uses to read GDPVision through
// /api/public/v1. The key is returned once, on creation; only its hash is
// stored. Creating and revoking need the PRD approver role (RLS + trigger,
// drizzle/migrations/0013). The API itself lives in api.server.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { serverPublicOrigin } from "@/lib/personas/public-origin";
import { db, governanceError } from "@/lib/syndication/db";

export const API_SCOPES = [
  "brand",
  "kpis",
  "commitments",
  "ministries",
  "sectors",
  "datasets",
  "procurement",
  "projects",
  "brain",
  "sources",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABEL: Record<ApiScope, string> = {
  brand: "Brand tokens, flag, favicon and logo",
  kpis: "Country indicators with citations",
  commitments: "Cabinet commitments and Mandate Compact pledges",
  ministries: "Ministries, mandates and portfolios",
  sectors: "Sector dossiers (public)",
  datasets: "Open-data register: standards coverage per requirement",
  procurement: "OC4IDS procurement package (approved projects)",
  projects: "Approved investor teasers",
  brain: "Second brain: verified public facts and risks",
  sources: "Official sources register",
};

export interface ApiKeyRow {
  id: string;
  country_code: string;
  prd_id: string | null;
  label: string;
  key_hint: string;
  scopes: ApiScope[];
  allowed_origins: string[];
  expires_at: string;
  last_used_at: string | null;
  request_count: number;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type ApiKeyStatus = "active" | "expired" | "revoked";
export type ApiKeyView = ApiKeyRow & { status: ApiKeyStatus };

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** `gdpv_<code>_<43 url-safe chars>`; the prefix lets a leaked key be recognised in logs. */
function newKey(code: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const body = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `gdpv_${code.toLowerCase()}_${body}`;
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

function statusOf(k: ApiKeyRow, now = Date.now()): ApiKeyStatus {
  if (k.revoked_at) return "revoked";
  if (Date.parse(k.expires_at) <= now) return "expired";
  return "active";
}

export const listApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ keys: ApiKeyView[]; baseUrl: string; canManage: boolean }> => {
      const c = db(context.supabase);
      const [{ data: rows, error }, can] = await Promise.all([
        c
          .from("egov_api_keys")
          .select(
            "id,country_code,prd_id,label,key_hint,scopes,allowed_origins,expires_at,last_used_at,request_count,revoked_at,created_by,created_at",
          )
          .eq("country_code", data.code)
          .order("created_at", { ascending: false }),
        c.rpc("can_approve_egov", { _user_id: context.userId, _country_code: data.code }),
      ]);
      if (error) throw governanceError(error);
      const now = Date.now();
      return {
        keys: ((rows ?? []) as ApiKeyRow[]).map((k) => ({ ...k, status: statusOf(k, now) })),
        baseUrl: `${await resolveOrigin()}/api/public/v1`,
        canManage: !!can.data,
      };
    },
  );

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        prdId: z.string().uuid().nullable().optional(),
        label: z
          .string()
          .trim()
          .min(2, "Name the platform or environment this key is for.")
          .max(120),
        scopes: z.array(z.enum(API_SCOPES)).min(1, "Choose at least one resource."),
        allowedOrigins: z.array(z.string().trim().url().max(200)).max(10).default([]),
        expiresInDays: z.number().int().min(1).max(730).default(365),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const key = newKey(data.code);
    const key_hash = await sha256Hex(key);
    const expires_at = new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString();
    const { data: row, error } = await db(context.supabase)
      .from("egov_api_keys")
      .insert({
        country_code: data.code,
        prd_id: data.prdId ?? null,
        label: data.label,
        key_hash,
        key_hint: key.slice(-4),
        scopes: Array.from(new Set(data.scopes)),
        allowed_origins: data.allowedOrigins.map((o) => new URL(o).origin),
        expires_at,
      })
      .select("id,label,key_hint,expires_at,scopes")
      .single();
    if (error) throw governanceError(error);
    // The only time the key leaves the server.
    return {
      ...(row as Pick<ApiKeyRow, "id" | "label" | "key_hint" | "expires_at" | "scopes">),
      key,
      baseUrl: `${await resolveOrigin()}/api/public/v1`,
    };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, id: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db(context.supabase)
      .from("egov_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("country_code", data.code)
      .select("id,revoked_at")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("Only a PRD approver can revoke a key.");
    return row as { id: string; revoked_at: string };
  });
