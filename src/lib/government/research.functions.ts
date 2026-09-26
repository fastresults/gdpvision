// @domain government
// @tables government_offices,statutory_bodies,ministries,ministry_profiles,onboarding_drafts,countries,sectors
// @ui src/routes/_authenticated/admin/countries.$code.government.tsx
//
// Filling the machinery-of-government record.
//
//   backfillGovernment — deterministic: the head of government from the
//     onboarding profile, and a Cabinet office for every ministry profile
//     that names a minister (with the public parts of minister_profile).
//   researchOffices / researchStatutoryBodies — one research call each
//     (Perplexity with the official-domain allowlist, then the fallbacks),
//     citing sources.
//
// Every row arrives as a private draft. Verified rows are never overwritten:
// a person has already checked them, so new research is reported, not
// applied. Writes go through the caller's client, so row-level security
// decides who may fill the record.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError, type AnyClient } from "@/lib/syndication/db";

import {
  BODY_KINDS,
  OFFICE_KEYS,
  OFFICE_LABEL,
  OFFICE_PRECEDENCE,
  slugify,
  type BodyKind,
  type OfficeKey,
} from "./db";

export interface FillResult {
  inserted: number;
  updated: number;
  /** Verified rows whose research differed; left for a person to review. */
  heldVerified: number;
  tier?: string;
  sources?: number;
}

type Ministry = { slug: string; name: string };

const STOP = new Set([
  "ministry",
  "of",
  "the",
  "and",
  "for",
  "office",
  "department",
  "affairs",
  "&",
]);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));

/** The ministry a free-text portfolio most plausibly names, if any. */
export function matchMinistry(
  text: string | null | undefined,
  ministries: Ministry[],
): string | null {
  if (!text) return null;
  const t = new Set(tokens(text));
  if (!t.size) return null;
  let best: { slug: string; score: number } | null = null;
  for (const m of ministries) {
    const mt = tokens(m.name);
    if (!mt.length) continue;
    const hit = mt.filter((x) => t.has(x)).length;
    const score = hit / mt.length;
    if (hit > 0 && (!best || score > best.score)) best = { slug: m.slug, score };
  }
  return best && best.score >= 0.34 ? best.slug : null;
}

async function loadMinistries(sb: AnyClient, code: string): Promise<Ministry[]> {
  const { data } = await db(sb).from("ministries").select("slug,name").eq("country_code", code);
  return (data ?? []) as Ministry[];
}

/** Upsert rows keyed by `key`; verified rows are held, not overwritten. */
async function upsertRows(
  sb: AnyClient,
  table: "government_offices" | "statutory_bodies",
  code: string,
  rows: Array<Record<string, unknown>>,
  keyOf: (r: Record<string, unknown>) => string,
): Promise<FillResult> {
  const c = db(sb);
  const { data: existing, error } = await c
    .from(table)
    .select(table === "government_offices" ? "id,office_key,portfolio,status" : "id,slug,status")
    .eq("country_code", code);
  if (error) throw governanceError(error);
  const byKey = new Map(
    ((existing ?? []) as unknown as Array<Record<string, unknown>>).map((r) => [keyOf(r), r]),
  );
  const out: FillResult = { inserted: 0, updated: 0, heldVerified: 0 };
  for (const r of rows) {
    const cur = byKey.get(keyOf(r));
    if (!cur) {
      const { error: e } = await c.from(table).insert({ ...r, country_code: code });
      if (e) throw governanceError(e);
      out.inserted++;
    } else if (cur.status === "verified") {
      out.heldVerified++;
    } else if (cur.status !== "retired") {
      const { error: e } = await c
        .from(table)
        .update(r)
        .eq("id", cur.id as string);
      if (e) throw governanceError(e);
      out.updated++;
    }
  }
  return out;
}

const officeKey = (r: Record<string, unknown>) => `${r.office_key}|${String(r.portfolio ?? "")}`;
const bodyKey = (r: Record<string, unknown>) => String(r.slug);

async function assertCanFill(sb: AnyClient, userId: string, code: string) {
  const c = db(sb);
  const [a, b] = await Promise.all([
    c.rpc("has_role", { _user_id: userId, _role: "admin" }),
    c.rpc("can_approve_egov", { _user_id: userId, _country_code: code }),
  ]);
  if (!a.data && !b.data)
    throw new Error(
      "Only a global admin or the country's PRD approver can fill the government record.",
    );
}

// ------------------------------------------------------------------ back-fill

export const backfillGovernment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }): Promise<FillResult> => {
    await assertCanFill(context.supabase, context.userId, data.code);
    const c = db(context.supabase);
    const [ministries, { data: profiles }, { data: drafts }] = await Promise.all([
      loadMinistries(context.supabase, data.code),
      c
        .from("ministry_profiles")
        .select("ministry_slug,minister,minister_profile,citations")
        .eq("country_code", data.code),
      c
        .from("onboarding_drafts")
        .select("payload,edited_payload,created_at")
        .eq("country_code", data.code)
        .eq("stage", "profile")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const name = new Map(ministries.map((m) => [m.slug, m.name]));
    const rows: Array<Record<string, unknown>> = [];

    const draft = (
      (drafts ?? []) as Array<{
        payload: Record<string, unknown>;
        edited_payload: Record<string, unknown> | null;
      }>
    )[0];
    const hog = String((draft?.edited_payload ?? draft?.payload)?.head_of_government ?? "").trim();
    const pmProfile = ((profiles ?? []) as Array<Record<string, unknown>>).find(
      (p) =>
        p.ministry_slug === "prime-minister" ||
        /prime/i.test(String(name.get(String(p.ministry_slug)) ?? "")),
    );
    const hogName =
      (pmProfile?.minister as string | null) ??
      (hog && !/unknown/i.test(hog) ? hog.replace(/\s*\(.*\)\s*$/, "") : null);
    if (hogName)
      rows.push({
        office_key: "head_of_government",
        title: "Prime Minister",
        holder_name: hogName,
        ministry_slug: (pmProfile?.ministry_slug as string | undefined) ?? null,
        portfolio: "",
        precedence: OFFICE_PRECEDENCE.head_of_government,
        origin: "backfill",
        confidence: pmProfile?.minister ? "medium" : "low",
      });

    for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
      const slug = String(p.ministry_slug);
      if (!p.minister || slug === pmProfile?.ministry_slug) continue;
      const mp = (p.minister_profile ?? {}) as Record<string, unknown>;
      const contact = (mp.contact ?? {}) as Record<string, unknown>;
      rows.push({
        office_key: "cabinet_minister",
        title:
          typeof mp.title === "string" && mp.title
            ? mp.title
            : `Minister — ${name.get(slug) ?? slug}`,
        holder_name: p.minister,
        ministry_slug: slug,
        portfolio: name.get(slug) ?? slug,
        precedence: OFFICE_PRECEDENCE.cabinet_minister,
        party: typeof mp.party === "string" ? mp.party : null,
        appointed_on:
          typeof mp.appointed_at === "string" && /^\d{4}-\d{2}-\d{2}/.test(mp.appointed_at)
            ? mp.appointed_at.slice(0, 10)
            : null,
        portrait_url: typeof mp.portrait_url === "string" ? mp.portrait_url : null,
        bio: typeof mp.bio === "string" ? mp.bio.slice(0, 2000) : null,
        // Office contact only — never personal details.
        contact: {
          office_phone: contact.office_phone ?? null,
          email: contact.email ?? null,
          office_address: contact.office_address ?? null,
          website: contact.website ?? null,
        },
        source_url: typeof mp.source_url === "string" ? mp.source_url : null,
        citations: Array.isArray(p.citations) ? (p.citations as unknown[]).slice(0, 8) : [],
        origin: "backfill",
        confidence: "medium",
      });
    }
    if (!rows.length) return { inserted: 0, updated: 0, heldVerified: 0 };
    return upsertRows(context.supabase, "government_offices", data.code, rows, officeKey);
  });

// ------------------------------------------------------------------ research

async function research<T>(
  code: string,
  topic: string,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  schemaHint: string,
  validate: (v: T) => boolean,
  empty: T,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { buildCountryContext } = await import("@/lib/country-onboarding/country-context.server");
  const { runWithFallbacks, jsonParser } = await import("@/lib/country-onboarding/fallback.server");
  const ctx = await buildCountryContext(supabaseAdmin, code);
  return runWithFallbacks<T>({
    context: ctx,
    topic,
    perplexity: {
      model: "sonar-pro",
      system,
      user: user.replace("{country}", ctx.name),
      responseSchema: schema,
      recency: "month",
    },
    gemini: { system, user: user.replace("{country}", ctx.name), schemaHint },
    parse: jsonParser<T>(),
    validate,
    infer: () => empty,
  });
}

const OfficesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    offices: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          office_key: { type: "string", enum: [...OFFICE_KEYS] },
          title: { type: "string" },
          holder_name: { type: ["string", "null"] },
          portfolio: { type: "string" },
          party: { type: ["string", "null"] },
          appointed_on: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
        },
        required: [
          "office_key",
          "title",
          "holder_name",
          "portfolio",
          "party",
          "appointed_on",
          "source_url",
        ],
      },
    },
  },
  required: ["offices"],
} as const;

type OfficesPayload = {
  offices: Array<{
    office_key: string;
    title: string;
    holder_name: string | null;
    portfolio: string;
    party: string | null;
    appointed_on: string | null;
    source_url: string | null;
  }>;
};

export const researchOffices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }): Promise<FillResult> => {
    await assertCanFill(context.supabase, context.userId, data.code);
    const fb = await research<OfficesPayload>(
      data.code,
      "head of state, prime minister, cabinet ministers and portfolios",
      "You are a government-structure researcher. Answer with one JSON object matching the schema. Use the government's official portal, the Cabinet Office, the Gazette and Parliament first. List only offices currently held. Never guess a name: use null when no source names the holder. Dates as YYYY-MM-DD or null.",
      "For {country}, list the current offices of state: the head of state and Governor-General (if any), the Prime Minister, the Deputy Prime Minister, every Cabinet minister with their exact portfolio title, the Attorney General, Ministers of State, the Cabinet Secretary, the Speaker, the President of the Senate and the Leader of the Opposition. Give each office_key, the official title, the holder's name, the portfolio (empty string for offices without one), party, date appointed and the source URL.",
      OfficesSchema as unknown as Record<string, unknown>,
      '{ "offices": [{ "office_key": one of ' +
        OFFICE_KEYS.join("|") +
        ', "title": string, "holder_name": string|null, "portfolio": string, "party": string|null, "appointed_on": "YYYY-MM-DD"|null, "source_url": string|null }] }',
      (v) =>
        Array.isArray(v?.offices) &&
        v.offices.length >= 3 &&
        v.offices.some((o) => o.office_key === "head_of_government" && !!o.holder_name),
      { offices: [] },
    );
    const ministries = await loadMinistries(context.supabase, data.code);
    const cites = fb.citations.slice(0, 10).map((c) => ({ url: c.url, title: c.title ?? null }));
    const seen = new Set<string>();
    const rows = (fb.data?.offices ?? [])
      .filter((o) => (OFFICE_KEYS as readonly string[]).includes(o.office_key) && o.title)
      .map((o) => {
        const key = o.office_key as OfficeKey;
        const portfolio = (o.portfolio ?? "").trim().slice(0, 300);
        return {
          office_key: key,
          title: o.title.trim().slice(0, 200) || OFFICE_LABEL[key],
          holder_name: o.holder_name?.trim() || null,
          ministry_slug: matchMinistry(portfolio || o.title, ministries),
          portfolio,
          precedence: OFFICE_PRECEDENCE[key],
          party: o.party?.trim() || null,
          appointed_on:
            o.appointed_on && /^\d{4}-\d{2}-\d{2}$/.test(o.appointed_on) ? o.appointed_on : null,
          source_url: o.source_url && /^https?:\/\//.test(o.source_url) ? o.source_url : null,
          citations: cites,
          origin: "research",
          confidence:
            fb.tier === "perplexity" && fb.citations.length >= 2
              ? "high"
              : fb.tier === "inferred"
                ? "low"
                : "medium",
        } as Record<string, unknown>;
      })
      .filter((r) => {
        const k = officeKey(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (!rows.length)
      return {
        inserted: 0,
        updated: 0,
        heldVerified: 0,
        tier: fb.tier,
        sources: fb.citations.length,
      };
    const res = await upsertRows(
      context.supabase,
      "government_offices",
      data.code,
      rows,
      officeKey,
    );
    return { ...res, tier: fb.tier, sources: fb.citations.length };
  });

const BodiesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bodies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          acronym: { type: ["string", "null"] },
          kind: { type: "string", enum: [...BODY_KINDS] },
          parent_ministry: { type: ["string", "null"] },
          enabling_act: { type: ["string", "null"] },
          act_year: { type: ["integer", "null"] },
          mandate: { type: "string" },
          head_name: { type: ["string", "null"] },
          head_title: { type: ["string", "null"] },
          services: { type: "array", items: { type: "string" } },
          sector: { type: ["string", "null"] },
          website: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
        },
        required: [
          "name",
          "acronym",
          "kind",
          "parent_ministry",
          "enabling_act",
          "act_year",
          "mandate",
          "head_name",
          "head_title",
          "services",
          "sector",
          "website",
          "source_url",
        ],
      },
    },
  },
  required: ["bodies"],
} as const;

type BodiesPayload = {
  bodies: Array<{
    name: string;
    acronym: string | null;
    kind: string;
    parent_ministry: string | null;
    enabling_act: string | null;
    act_year: number | null;
    mandate: string;
    head_name: string | null;
    head_title: string | null;
    services: string[];
    sector: string | null;
    website: string | null;
    source_url: string | null;
  }>;
};

export const researchStatutoryBodies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }): Promise<FillResult> => {
    await assertCanFill(context.supabase, context.userId, data.code);
    const fb = await research<BodiesPayload>(
      data.code,
      "statutory bodies, authorities, commissions, regulators and state-owned enterprises",
      "You are a government-structure researcher. Answer with one JSON object matching the schema. Use the government's official portal, the laws of the country (the Act that creates each body), the Gazette and each body's own website. Include only bodies that currently exist. Never guess: use null where no source says.",
      "For {country}, list the statutory bodies and public agencies: authorities, commissions, boards, regulators, public corporations, state-owned enterprises, funds and executive agencies — for example investment, tourism, ports, airports, utilities, social security, revenue, financial services regulation, telecommunications, development banks and national training bodies. For each give the name, acronym, kind, the parent ministry, the enabling Act and its year, a one-sentence mandate, the head's name and title, the public services it delivers (short labels), the sector it serves, its website and the source URL.",
      BodiesSchema as unknown as Record<string, unknown>,
      '{ "bodies": [{ "name": string, "acronym": string|null, "kind": one of ' +
        BODY_KINDS.join("|") +
        ', "parent_ministry": string|null, "enabling_act": string|null, "act_year": number|null, "mandate": string, "head_name": string|null, "head_title": string|null, "services": string[], "sector": string|null, "website": string|null, "source_url": string|null }] }',
      (v) => Array.isArray(v?.bodies) && v.bodies.length >= 3,
      { bodies: [] },
    );
    const c = db(context.supabase);
    const [ministries, { data: sectors }] = await Promise.all([
      loadMinistries(context.supabase, data.code),
      c.from("sectors").select("code,label"),
    ]);
    const sectorList = (sectors ?? []) as Array<{ code: string; label: string }>;
    const sectorOf = (s: string | null) => {
      if (!s) return null;
      const v = s.toLowerCase();
      return (
        sectorList.find((x) => x.code === v || x.label.toLowerCase() === v)?.code ??
        sectorList.find(
          (x) =>
            v.includes(x.code.replace(/-/g, " ")) ||
            x.label
              .toLowerCase()
              .split(/[ &]+/)
              .some((w) => w.length > 3 && v.includes(w)),
        )?.code ??
        null
      );
    };
    const url = (u: string | null) => (u && /^https?:\/\//.test(u) ? u.slice(0, 500) : null);
    const cites = fb.citations.slice(0, 10).map((x) => ({ url: x.url, title: x.title ?? null }));
    const seen = new Set<string>();
    const rows = (fb.data?.bodies ?? [])
      .filter((b) => b.name?.trim())
      .map((b) => {
        const kind = (
          (BODY_KINDS as readonly string[]).includes(b.kind) ? b.kind : "statutory_body"
        ) as BodyKind;
        return {
          slug: slugify(b.acronym ? `${b.name} ${b.acronym}` : b.name),
          name: b.name.trim().slice(0, 200),
          acronym: b.acronym?.trim().slice(0, 20) || null,
          kind,
          parent_ministry_slug: matchMinistry(b.parent_ministry, ministries),
          enabling_act: b.enabling_act?.trim().slice(0, 300) || null,
          act_year:
            Number.isInteger(b.act_year) && b.act_year! > 1800 && b.act_year! < 2100
              ? b.act_year
              : null,
          mandate: (b.mandate ?? "").trim().slice(0, 2000),
          head_name: b.head_name?.trim() || null,
          head_title: b.head_title?.trim() || null,
          sector_code: sectorOf(b.sector),
          services: (b.services ?? [])
            .map((s) => String(s).trim())
            .filter(Boolean)
            .slice(0, 40),
          website: url(b.website),
          source_url: url(b.source_url),
          citations: cites,
          origin: "research",
          confidence:
            fb.tier === "perplexity" && fb.citations.length >= 2
              ? "high"
              : fb.tier === "inferred"
                ? "low"
                : "medium",
        } as Record<string, unknown>;
      })
      .filter((r) => {
        const k = bodyKey(r);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (!rows.length)
      return {
        inserted: 0,
        updated: 0,
        heldVerified: 0,
        tier: fb.tier,
        sources: fb.citations.length,
      };
    const res = await upsertRows(context.supabase, "statutory_bodies", data.code, rows, bodyKey);
    return { ...res, tier: fb.tier, sources: fb.citations.length };
  });
