// @domain investments
// @tables investment_share_links,investment_share_views,investment_projects,investment_packages,investor_interests,countries,app_settings
// @ui src/routes/i.$token.tsx
//
// The public, unauthenticated side of share links. No auth middleware: the
// token in the URL is the credential. Handlers use the service-role client,
// so every check the database would otherwise make is repeated here:
//   the feature flag is on, the link exists, is not revoked, has not expired,
//   has views left, and its project is approved right now.
// Every failure returns the same "This link is not available." so a caller
// cannot tell a wrong token from a revoked or expired one.
//
// Only investor-facing fields leave this file: never the sponsor, compliance
// data, internal ids of people, or draft packages.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import { db, type PackageKind, type ShareLinkRow } from "@/lib/syndication/db";

const NOT_AVAILABLE = "This link is not available.";
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const INTEREST_LIMIT_PER_HOUR = 5;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { typed: supabaseAdmin, c: db(supabaseAdmin) };
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

type ProjectRow = {
  id: string;
  title: string;
  sector: string | null;
  structure: string | null;
  stage: string;
  capex_usd: number | null;
  summary: string | null;
  revenue_model: string | null;
  es_category: string | null;
  climate_alignment: string | null;
  risks: string | null;
  updated_at: string;
  version: number;
  approval_status: string;
  country_code: string;
};

/** Loads a link and its project, or throws the generic message. */
async function openLink(token: string, opts: { countView: boolean }) {
  if (!TOKEN_RE.test(token)) throw new Error(NOT_AVAILABLE);
  const { typed, c } = await admin();

  const { data: flag } = await typed
    .from("app_settings")
    .select("value")
    .eq("key", "public_project_links_enabled")
    .maybeSingle();
  if ((flag?.value ?? "false").trim().toLowerCase() !== "true") throw new Error(NOT_AVAILABLE);

  const hash = await sha256Hex(token);
  const { data: linkRow } = await c
    .from("investment_share_links")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();
  const link = linkRow as ShareLinkRow | null;
  if (!link) throw new Error(NOT_AVAILABLE);
  if (link.revoked_at) throw new Error(NOT_AVAILABLE);
  if (Date.parse(link.expires_at) <= Date.now()) throw new Error(NOT_AVAILABLE);
  if (opts.countView && link.max_views != null && link.view_count >= link.max_views)
    throw new Error(NOT_AVAILABLE);

  const { data: projRow } = await c
    .from("investment_projects")
    .select(
      "id,title,sector,structure,stage,capex_usd,summary,revenue_model,es_category,climate_alignment,risks,updated_at,version,approval_status,country_code",
    )
    .eq("id", link.project_id)
    .maybeSingle();
  const project = projRow as ProjectRow | null;
  // Editing an approved project reopens it to draft, which pauses every link.
  if (!project || project.approval_status !== "approved") throw new Error(NOT_AVAILABLE);
  return { link, project, c, typed };
}

/** Internal review notes never leave the building. */
function withoutWarnings(content: Json): Json {
  if (content && typeof content === "object" && !Array.isArray(content) && "warnings" in content) {
    const { warnings: _omit, ...rest } = content as Record<string, Json>;
    return { ...rest, warnings: [] } as Json;
  }
  return content;
}

export type PublicPackage = { kind: PackageKind; version: number; content: Json };

export type PublicProject = {
  countryName: string;
  allowInterest: boolean;
  project: {
    title: string;
    sector: string | null;
    structure: string | null;
    stage: string;
    capex_usd: number | null;
    summary: string | null;
    revenue_model: string | null;
    es_category: string | null;
    climate_alignment: string | null;
    risks: string | null;
    updated: string;
  };
  packages: PublicPackage[];
};

export const getPublicProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const r = z
      .object({ token: z.string().max(100), referrer: z.string().max(500).optional() })
      .safeParse(d);
    if (!r.success) throw new Error(NOT_AVAILABLE);
    return r.data;
  })
  .handler(async ({ data }): Promise<PublicProject> => {
    try {
      const { link, project, c, typed } = await openLink(data.token, { countView: true });

      const [{ data: country }, { data: pkgRows }] = await Promise.all([
        typed.from("countries").select("name").eq("code", project.country_code).maybeSingle(),
        link.include_packages?.length
          ? c
              .from("investment_packages")
              .select("kind,version,content")
              .eq("project_id", project.id)
              .eq("status", "approved")
              .eq("project_version", project.version)
              .in("kind", link.include_packages)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);

      // Count and record the view in one statement, so simultaneous visits
      // cannot overrun max_views. False means the last view was just used.
      const { ip, userAgent } = await requestMeta();
      const { data: counted, error: viewErr } = await c.rpc("record_investment_share_view", {
        _link_id: link.id,
        _visitor_hash: await sha256Hex(`${ip}${link.id}`),
        _user_agent: userAgent,
        _referrer: data.referrer ?? null,
        _event: "view",
        _count: true,
      });
      if (viewErr || counted !== true) throw new Error(NOT_AVAILABLE);

      return {
        countryName: (country as { name?: string } | null)?.name ?? project.country_code,
        allowInterest: link.allow_interest,
        project: {
          title: project.title,
          sector: project.sector,
          structure: project.structure,
          stage: project.stage,
          capex_usd: project.capex_usd == null ? null : Number(project.capex_usd),
          summary: project.summary,
          revenue_model: project.revenue_model,
          es_category: project.es_category,
          climate_alignment: project.climate_alignment,
          risks: project.risks,
          updated: project.updated_at,
        },
        packages: ((pkgRows ?? []) as PublicPackage[]).map((p) => ({
          kind: p.kind,
          version: p.version,
          content: withoutWarnings(p.content),
        })),
      };
    } catch {
      throw new Error(NOT_AVAILABLE);
    }
  });

/** Records that a visitor opened one of the shared packages. Silent on failure. */
export const recordPublicPackageOpen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const r = z.object({ token: z.string().max(100), kind: z.string().max(20) }).safeParse(d);
    if (!r.success) throw new Error(NOT_AVAILABLE);
    return r.data;
  })
  .handler(async ({ data }) => {
    try {
      const { link, c } = await openLink(data.token, { countView: false });
      const { ip, userAgent } = await requestMeta();
      await c.rpc("record_investment_share_view", {
        _link_id: link.id,
        _visitor_hash: await sha256Hex(`${ip}${link.id}`),
        _user_agent: userAgent,
        _referrer: null,
        _event: "package_open",
        _count: false,
      });
    } catch {
      // A missed statistic is not worth an error on the investor's screen.
    }
    return { ok: true };
  });

const interestSchema = z.object({
  token: z.string().max(100),
  name: z.string().trim().min(2, "Please give your name.").max(120),
  email: z.string().trim().email("Please give a valid email address.").max(200),
  organisation: z.string().trim().max(160).optional().default(""),
  message: z
    .string()
    .trim()
    .max(2000, "Please keep the message under 2,000 characters.")
    .optional()
    .default(""),
  /** Honeypot. Hidden from people; bots fill it in. */
  website: z.string().max(500).optional().default(""),
});

export const submitInterest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const r = interestSchema.safeParse(d);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Please check the form.");
    return r.data;
  })
  .handler(async ({ data }) => {
    // Accept and drop anything that filled the honeypot.
    if (data.website.trim()) return { ok: true };

    let opened: Awaited<ReturnType<typeof openLink>>;
    try {
      // A visitor who used the last allowed view can still reply.
      opened = await openLink(data.token, { countView: false });
    } catch {
      throw new Error(NOT_AVAILABLE);
    }
    const { link, project, c } = opened;
    if (!link.allow_interest) throw new Error(NOT_AVAILABLE);

    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await c
      .from("investor_interests")
      .select("id", { count: "exact", head: true })
      .eq("share_link_id", link.id)
      .gte("created_at", since);
    if ((count ?? 0) >= INTEREST_LIMIT_PER_HOUR) {
      throw new Error(
        "Several enquiries have already been sent through this link in the last hour. Please try again later.",
      );
    }

    const { error } = await c.from("investor_interests").insert({
      country_code: project.country_code,
      project_id: project.id,
      share_link_id: link.id,
      source: "share_link",
      stage: "identified",
      contact_name: data.name,
      contact_email: data.email,
      organisation: data.organisation || null,
      message: data.message || null,
    });
    if (error) throw new Error("Your message could not be sent. Please try again.");

    const { ip, userAgent } = await requestMeta();
    await c.rpc("record_investment_share_view", {
      _link_id: link.id,
      _visitor_hash: await sha256Hex(`${ip}${link.id}`),
      _user_agent: userAgent,
      _referrer: null,
      _event: "interest",
      _count: false,
    });
    return { ok: true };
  });
