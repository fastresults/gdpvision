// @domain egov
// @tables egov_prd_share_links,egov_prds,egov_prd_sections,countries,app_settings
// @ui src/routes/e.$token.tsx
//
// The public, unauthenticated side of PRD share links. No auth middleware:
// the token in the URL is the credential. The service-role client is used,
// so every check the database would otherwise make is repeated here: the
// flag is on, the link exists, is not revoked, has not expired, has views
// left, and its PRD is approved right now. Every failure returns the same
// "This link is not available." Only the approved text leaves this file —
// never the context packs, citations, people or history.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { db } from "@/lib/syndication/db";

import type { BrandTokens } from "./brand";
import { brandOf, type PrdRow, type SectionRow } from "./db";
import { prdToMarkdown } from "./markdown";

const NOT_AVAILABLE = "This link is not available.";
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requestMeta(): Promise<{ ip: string; userAgent: string | null }> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const h = getRequest()?.headers;
    const ip =
      h?.get("cf-connecting-ip") ||
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h?.get("x-real-ip") ||
      "unknown";
    const ua = h?.get("user-agent");
    return { ip, userAgent: ua ? ua.slice(0, 200) : null };
  } catch {
    return { ip: "unknown", userAgent: null };
  }
}

export interface PublicPrd {
  title: string;
  countryName: string;
  countryCode: string;
  version: number;
  approvedAt: string | null;
  platformName: string;
  brand: Pick<BrandTokens, "ink" | "paper" | "accent" | "borders"> | null;
  sections: Array<{ ordinal: number; heading: string; body_md: string }>;
  markdown: string;
}

export const getPublicPrd = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }): Promise<PublicPrd> => {
    if (!TOKEN_RE.test(data.token)) throw new Error(NOT_AVAILABLE);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = db(supabaseAdmin);

    const { data: flag } = await c
      .from("app_settings")
      .select("value")
      .eq("key", "public_prd_links_enabled")
      .maybeSingle();
    if ((flag?.value ?? "false").trim().toLowerCase() !== "true") throw new Error(NOT_AVAILABLE);

    const hash = await sha256Hex(data.token);
    const { data: link } = await c
      .from("egov_prd_share_links")
      .select("id,prd_id,country_code,max_views,view_count,expires_at,revoked_at")
      .eq("token_hash", hash)
      .maybeSingle();
    const l = link as {
      id: string;
      prd_id: string;
      country_code: string;
      max_views: number | null;
      view_count: number;
      expires_at: string;
      revoked_at: string | null;
    } | null;
    if (!l || l.revoked_at || Date.parse(l.expires_at) <= Date.now())
      throw new Error(NOT_AVAILABLE);
    if (l.max_views != null && l.view_count >= l.max_views) throw new Error(NOT_AVAILABLE);

    const { data: prdRow } = await c
      .from("egov_prds")
      .select("id,country_code,version,title,status,scope,brand,approved_at")
      .eq("id", l.prd_id)
      .maybeSingle();
    const prd = prdRow as Pick<
      PrdRow,
      "id" | "country_code" | "version" | "title" | "status" | "scope" | "brand" | "approved_at"
    > | null;
    if (!prd || prd.status !== "approved") throw new Error(NOT_AVAILABLE);

    const meta = await requestMeta();
    const { data: counted } = await c.rpc("record_egov_prd_view", {
      _link_id: l.id,
      _visitor_hash: await sha256Hex(`${meta.ip}|${l.id}`),
      _user_agent: meta.userAgent,
    });
    if (!counted) throw new Error(NOT_AVAILABLE);

    const [{ data: sections }, { data: country }] = await Promise.all([
      c
        .from("egov_prd_sections")
        .select("ordinal,heading,body_md,status,stage_key")
        .eq("prd_id", prd.id)
        .order("ordinal"),
      c.from("countries").select("name").eq("code", prd.country_code).maybeSingle(),
    ]);
    const secs = (
      (sections ?? []) as Array<
        Pick<SectionRow, "ordinal" | "heading" | "body_md" | "status" | "stage_key">
      >
    ).filter((s) => s.status !== "pending");
    const countryName = ((country as { name?: string } | null)?.name ?? prd.country_code).trim();
    const brand = brandOf(prd.brand);
    return {
      title: prd.title,
      countryName,
      countryCode: prd.country_code,
      version: prd.version,
      approvedAt: prd.approved_at,
      platformName: prd.scope?.platform_name ?? "",
      brand: brand
        ? { ink: brand.ink, paper: brand.paper, accent: brand.accent, borders: brand.borders }
        : null,
      sections: secs.map((s) => ({ ordinal: s.ordinal, heading: s.heading, body_md: s.body_md })),
      markdown: prdToMarkdown(prd, countryName, secs, brand),
    };
  });
