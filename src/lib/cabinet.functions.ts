// Chamber 06 — The Cabinet Room server functions.
// All authed via requireSupabaseAuth; RLS enforces country scoping via has_country_access.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const CountryInput = z.object({ countryCode: z.string().min(3).max(4) });
const CC = z.string().min(3).max(4);

// ─── Types ───────────────────────────────────────────────────────────────────

export type Classification = "public" | "internal" | "restricted" | "secret";
export type MotionKind = "approve" | "note" | "refer" | "defer";
export type ItemStatus = "pending" | "presenting" | "decided" | "skipped";

export interface DossierRef {
  kind: "kpi" | "scenario" | "strategy" | "sector_dossier" | "figure_snapshot" | "narrative" | "url";
  id?: string;
  label: string;
  href?: string;
}

export interface AgendaItem {
  id: string;
  session_id: string;
  ordinal: number;
  title: string;
  sponsor_ministry_id: string | null;
  sponsor_ministry_name?: string | null;
  classification: Classification;
  time_box_min: number;
  recommendation: string | null;
  motion_kind: MotionKind;
  brief_md: string | null;
  dossier: DossierRef[];
  status: ItemStatus;
  readiness_score: number;
}

export interface CabinetSession {
  id: string;
  title: string;
  classification: Classification;
  scheduled_for: string | null;
  held_at: string | null;
  closed_at: string | null;
  chair_name: string | null;
  chair_signed_at: string | null;
  agenda_count: number;
}

export interface RoomOverview {
  countryCode: string;
  nextSession: CabinetSession | null;
  readiness: { total: number; ready: number; pct: number } | null;
  commitmentsHeat: Record<string, number>;
  overdueCount: number;
  decisionsVelocity: { week: string; count: number }[];
  medianDecisionMinutes: number | null;
  signals: SignalRow[];
  sessions: CabinetSession[];
}

export interface SignalRow {
  kind: "narrative" | "strategy" | "scenario" | "grade";
  id: string;
  title: string;
  priority: string | null;
  meta: string | null;
  hint: string;
}

// ─── Room overview ───────────────────────────────────────────────────────────

export const getRoomOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<RoomOverview> => {
    const cc = data.countryCode;
    const supa = context.supabase;

    const [{ data: sessions }, { data: commits }, { data: decisions }, { data: signals }, { data: strategies }, { data: scenarios }, { data: alerts }] =
      await Promise.all([
        supa.from("cabinet_sessions")
          .select("id,title,classification,scheduled_for,held_at,closed_at,chair_name,chair_signed_at,agenda")
          .eq("country_code", cc)
          .order("scheduled_for", { ascending: false, nullsFirst: false })
          .limit(50),
        supa.from("commitments").select("id,status,due_at").eq("country_code", cc),
        supa.from("decisions").select("id,recorded_at,duration_sec").eq("country_code", cc).order("recorded_at", { ascending: false }).limit(500),
        supa.from("intake_items").select("id,topic,severity,scope_key,created_at").eq("scope_key", cc).gte("severity", 4).is("story_key", null).order("created_at",{ascending:false}).limit(8),
        supa.from("fdi_strategies").select("id,name,status,updated_at").eq("country_code", cc).eq("status", "draft").order("updated_at",{ascending:false}).limit(8),
        supa.from("scenarios").select("id,title,status,updated_at").eq("country_code", cc).order("updated_at",{ascending:false}).limit(8),
        supa.from("grade_alerts").select("id,sector_code,previous_grade,new_grade,created_at").eq("country_code", cc).order("created_at",{ascending:false}).limit(8),
      ]);

    // Next session = earliest future scheduled, else most recent non-closed
    const now = new Date();
    const sortedSessions: CabinetSession[] = (sessions ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      title: r.title as string,
      classification: (r.classification as Classification) ?? "restricted",
      scheduled_for: (r.scheduled_for as string | null) ?? null,
      held_at: (r.held_at as string | null) ?? null,
      closed_at: (r.closed_at as string | null) ?? null,
      chair_name: (r.chair_name as string | null) ?? null,
      chair_signed_at: (r.chair_signed_at as string | null) ?? null,
      agenda_count: Array.isArray(r.agenda) ? (r.agenda as unknown[]).length : 0,
    }));
    const upcoming = sortedSessions
      .filter((s) => !s.closed_at && s.scheduled_for && new Date(s.scheduled_for) >= now)
      .sort((a, b) => (a.scheduled_for! < b.scheduled_for! ? -1 : 1));
    const nextSession = upcoming[0] ?? sortedSessions.find((s) => !s.closed_at) ?? null;

    // Readiness for the next session
    let readiness: RoomOverview["readiness"] = null;
    if (nextSession) {
      const { data: items } = await supa
        .from("cabinet_agenda_items")
        .select("readiness_score")
        .eq("session_id", nextSession.id);
      const total = items?.length ?? 0;
      const ready = (items ?? []).filter((i: { readiness_score: number }) => i.readiness_score >= 75).length;
      readiness = { total, ready, pct: total ? Math.round((ready / total) * 100) : 0 };
    }

    // Commitments heat
    const heat: Record<string, number> = { open: 0, in_progress: 0, delivered: 0, blocked: 0, cancelled: 0 };
    let overdue = 0;
    for (const c of commits ?? []) {
      heat[c.status] = (heat[c.status] ?? 0) + 1;
      if (c.due_at && new Date(c.due_at) < now && !["delivered", "cancelled"].includes(c.status)) overdue += 1;
    }

    // Decisions velocity by week (last 12)
    const buckets = new Map<string, number>();
    for (let w = 11; w >= 0; w--) {
      const d = new Date(now);
      d.setDate(d.getDate() - w * 7);
      const key = weekKey(d);
      buckets.set(key, 0);
    }
    let totalMin = 0;
    let counted = 0;
    const durations: number[] = [];
    for (const d of decisions ?? []) {
      const k = weekKey(new Date(d.recorded_at));
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      if (d.duration_sec != null) {
        durations.push(d.duration_sec);
        totalMin += d.duration_sec;
        counted += 1;
      }
    }
    const decisionsVelocity = Array.from(buckets.entries()).map(([week, count]) => ({ week, count }));
    const medianDecisionMinutes = counted ? Math.round(median(durations) / 60) : null;

    // Signals inbox
    const sig: SignalRow[] = [];
    for (const s of signals ?? []) sig.push({
      kind: "narrative",
      id: s.id,
      title: s.topic ?? "Untitled signal",
      priority: s.severity != null ? `P${6 - Math.min(5, Math.max(1, s.severity))}` : null,
      meta: "Narrative",
      hint: "High-severity signal awaiting triage",
    });
    for (const s of strategies ?? []) sig.push({
      kind: "strategy",
      id: s.id,
      title: s.name,
      priority: null,
      meta: "FDI Studio",
      hint: "Draft strategy awaiting cabinet approval",
    });
    for (const s of scenarios ?? []) sig.push({
      kind: "scenario",
      id: s.id,
      title: s.title,
      priority: null,
      meta: "Scenario",
      hint: "Recent scenario run — consider promoting",
    });
    for (const a of alerts ?? []) sig.push({
      kind: "grade",
      id: a.id,
      title: `${a.sector_code ?? "Ledger"} grade downgraded ${a.previous_grade}→${a.new_grade}`,
      priority: null,
      meta: "Ledger",
      hint: "Data confidence dropped — review evidence",
    });

    return {
      countryCode: cc,
      nextSession,
      readiness,
      commitmentsHeat: heat,
      overdueCount: overdue,
      decisionsVelocity,
      medianDecisionMinutes,
      signals: sig,
      sessions: sortedSessions,
    };
  });

function weekKey(d: Date): string {
  const y = d.getUTCFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const day = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const w = Math.ceil((day + start.getUTCDay() + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}
function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return 0;
  return n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export const createCabinetSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    countryCode: CC,
    title: z.string().min(1).max(240),
    scheduledFor: z.string().datetime().optional(),
    classification: z.enum(["public","internal","restricted","secret"]).default("restricted"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("cabinet_sessions").insert({
      country_code: data.countryCode,
      title: data.title,
      scheduled_for: data.scheduledFor ?? null,
      agenda: [] as unknown as Json,
      classification: data.classification,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: s, error }, { data: items }, { data: attendance }, { data: ministries }] = await Promise.all([
      context.supabase.from("cabinet_sessions").select("*").eq("id", data.sessionId).single(),
      context.supabase.from("cabinet_agenda_items").select("*").eq("session_id", data.sessionId).order("ordinal"),
      context.supabase.from("cabinet_attendance").select("*").eq("session_id", data.sessionId),
      context.supabase.from("ministries").select("id,name").order("sort_order"),
    ]);
    if (error) throw new Error(error.message);
    const mMap = new Map((ministries ?? []).map((m) => [m.id, m.name]));
    const enrichedItems = (items ?? []).map((i) => ({
      ...i,
      sponsor_ministry_name: i.sponsor_ministry_id ? mMap.get(i.sponsor_ministry_id) ?? null : null,
      dossier: Array.isArray(i.dossier) ? (i.dossier as DossierRef[]) : [],
    }));
    return { session: s, items: enrichedItems as AgendaItem[], attendance: attendance ?? [], ministries: ministries ?? [] };
  });

// ─── Agenda items ────────────────────────────────────────────────────────────

const AgendaItemSchema = z.object({
  id: z.string().uuid().optional(),
  sessionId: z.string().uuid(),
  countryCode: CC,
  title: z.string().min(1).max(240),
  sponsorMinistryId: z.string().uuid().nullable().optional(),
  classification: z.enum(["public","internal","restricted","secret"]).default("restricted"),
  timeBoxMin: z.number().int().min(1).max(180).default(10),
  recommendation: z.string().max(600).nullable().optional(),
  motionKind: z.enum(["approve","note","refer","defer"]).default("approve"),
  briefMd: z.string().max(20000).nullable().optional(),
  dossier: z.array(z.object({
    kind: z.enum(["kpi","scenario","strategy","sector_dossier","figure_snapshot","narrative","url"]),
    id: z.string().optional(),
    label: z.string(),
    href: z.string().optional(),
  })).default([]),
});

function computeReadiness(input: {
  title?: string;
  sponsorMinistryId?: string | null;
  recommendation?: string | null;
  briefMd?: string | null;
  dossier?: unknown[];
}): number {
  let score = 0;
  if (input.title && input.title.trim().length > 3) score += 20;
  if (input.sponsorMinistryId) score += 20;
  if (input.recommendation && input.recommendation.trim().length > 5) score += 20;
  if (input.briefMd && input.briefMd.trim().length > 40) score += 20;
  if (input.dossier && input.dossier.length > 0) score += 20;
  return score;
}

export const saveAgendaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AgendaItemSchema.parse(d))
  .handler(async ({ data, context }) => {
    const readiness = computeReadiness({
      title: data.title,
      sponsorMinistryId: data.sponsorMinistryId,
      recommendation: data.recommendation,
      briefMd: data.briefMd,
      dossier: data.dossier,
    });
    const row = {
      session_id: data.sessionId,
      country_code: data.countryCode,
      title: data.title,
      sponsor_ministry_id: data.sponsorMinistryId ?? null,
      classification: data.classification,
      time_box_min: data.timeBoxMin,
      recommendation: data.recommendation ?? null,
      motion_kind: data.motionKind,
      brief_md: data.briefMd ?? null,
      dossier: data.dossier as unknown as Json,
      readiness_score: readiness,
    };
    if (data.id) {
      const { error } = await context.supabase.from("cabinet_agenda_items").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: existing } = await context.supabase.from("cabinet_agenda_items").select("id").eq("session_id", data.sessionId);
    const { data: inserted, error } = await context.supabase.from("cabinet_agenda_items")
      .insert({ ...row, ordinal: (existing?.length ?? 0), created_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteAgendaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cabinet_agenda_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sessionId: z.string().uuid(),
    orderedIds: z.array(z.string().uuid()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    for (let i = 0; i < data.orderedIds.length; i++) {
      await context.supabase.from("cabinet_agenda_items").update({ ordinal: i }).eq("id", data.orderedIds[i]);
    }
    return { ok: true };
  });

// ─── Auto-brief via Lovable AI ───────────────────────────────────────────────

export const generateAgendaBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agendaItemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ brief: string }> => {
    const { data: item, error } = await context.supabase.from("cabinet_agenda_items")
      .select("title,recommendation,dossier,classification,motion_kind,country_code")
      .eq("id", data.agendaItemId).single();
    if (error) throw new Error(error.message);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const dossierLines = Array.isArray(item.dossier)
      ? (item.dossier as DossierRef[]).map((d, i) => `[${i+1}] ${d.kind}: ${d.label}${d.href ? " ("+d.href+")" : ""}`).join("\n")
      : "(no evidence attached)";
    const prompt = `Draft a McKinsey-grade cabinet brief for ${item.country_code}.
Topic: ${item.title}
Recommendation: ${item.recommendation ?? "(none)"}
Motion: ${item.motion_kind}
Evidence attached:
${dossierLines}

Write exactly 120 words in 3 short paragraphs:
1) Situation — the fact base drawn from the evidence
2) So-what — what this means for the country now
3) The ask — the specific decision cabinet is being asked to take
Use citation markers like [1] tied to the evidence numbers above. Plain prose. No headings. No bullet lists.`;
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt,
    });
    const brief = text.trim();
    const readiness = computeReadiness({
      title: item.title,
      recommendation: item.recommendation,
      briefMd: brief,
      dossier: Array.isArray(item.dossier) ? item.dossier : [],
    });
    await context.supabase.from("cabinet_agenda_items")
      .update({ brief_md: brief, readiness_score: readiness })
      .eq("id", data.agendaItemId);
    return { brief };
  });

// ─── Attendance ──────────────────────────────────────────────────────────────

export const saveAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sessionId: z.string().uuid(),
    countryCode: CC,
    rows: z.array(z.object({
      id: z.string().uuid().optional(),
      attendee_name: z.string().min(1),
      role: z.string().nullable().optional(),
      is_chair: z.boolean().default(false),
      present: z.boolean().default(true),
    })),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("cabinet_attendance").delete().eq("session_id", data.sessionId);
    if (data.rows.length) {
      const { error } = await context.supabase.from("cabinet_attendance").insert(
        data.rows.map((r) => ({
          session_id: data.sessionId,
          country_code: data.countryCode,
          attendee_name: r.attendee_name,
          role: r.role ?? null,
          is_chair: r.is_chair,
          present: r.present,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ─── Live outcome capture ────────────────────────────────────────────────────

export const recordAgendaOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    agendaItemId: z.string().uuid(),
    sessionId: z.string().uuid(),
    countryCode: CC,
    decisionTitle: z.string().min(1).max(300),
    decisionBody: z.string().max(4000).optional(),
    motionKind: z.enum(["approve","note","refer","defer"]),
    classification: z.enum(["public","internal","restricted","secret"]).default("restricted"),
    durationSec: z.number().int().nonnegative().optional(),
    vote: z.object({
      for_count: z.number().int().nonnegative().default(0),
      against_count: z.number().int().nonnegative().default(0),
      abstain_count: z.number().int().nonnegative().default(0),
      notes: z.string().max(1000).optional(),
    }).optional(),
    commitments: z.array(z.object({
      title: z.string().min(1).max(300),
      ministryId: z.string().uuid().nullable().optional(),
      dueAt: z.string().datetime().optional(),
      successMetric: z.string().max(300).optional(),
      sectorCode: z.string().max(64).optional(),
    })).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: dec, error } = await context.supabase.from("decisions").insert({
      session_id: data.sessionId,
      country_code: data.countryCode,
      title: data.decisionTitle,
      body: data.decisionBody ?? null,
      agenda_item_id: data.agendaItemId,
      motion_kind: data.motionKind,
      classification: data.classification,
      duration_sec: data.durationSec ?? null,
      recorded_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);

    if (data.vote) {
      await context.supabase.from("cabinet_votes").upsert({
        agenda_item_id: data.agendaItemId,
        country_code: data.countryCode,
        for_count: data.vote.for_count,
        against_count: data.vote.against_count,
        abstain_count: data.vote.abstain_count,
        notes: data.vote.notes ?? null,
      });
    }

    if (data.commitments.length) {
      const { error: cErr } = await context.supabase.from("commitments").insert(
        data.commitments.map((c) => ({
          decision_id: dec.id,
          agenda_item_id: data.agendaItemId,
          country_code: data.countryCode,
          title: c.title,
          ministry_id: c.ministryId ?? null,
          due_at: c.dueAt ?? null,
          success_metric: c.successMetric ?? null,
          sector_code: c.sectorCode ?? null,
          created_by: context.userId,
        })),
      );
      if (cErr) throw new Error(cErr.message);
    }

    await context.supabase.from("cabinet_agenda_items")
      .update({ status: "decided" })
      .eq("id", data.agendaItemId);

    return { decisionId: dec.id };
  });

export const closeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sessionId: z.string().uuid(),
    chairName: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("cabinet_sessions")
      .update({ held_at: now, closed_at: now, chair_name: data.chairName, chair_signed_at: now })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Register (decisions + commitments unified) ──────────────────────────────

export interface RegisterRow {
  kind: "decision" | "commitment";
  id: string;
  title: string;
  status: string;
  when: string;
  ministry_id: string | null;
  ministry_name: string | null;
  sector_code: string | null;
  session_id: string | null;
  motion_kind: string | null;
  classification: string | null;
  overdue: boolean;
}

export const listRegister = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<RegisterRow[]> => {
    const cc = data.countryCode;
    const now = new Date();
    const [{ data: decisions }, { data: commits }, { data: ministries }] = await Promise.all([
      context.supabase.from("decisions").select("id,title,recorded_at,session_id,motion_kind,classification").eq("country_code", cc).order("recorded_at",{ascending:false}).limit(500),
      context.supabase.from("commitments").select("id,title,status,due_at,ministry_id,sector_code,decision_id").eq("country_code", cc).order("due_at",{ascending:true,nullsFirst:false}).limit(500),
      context.supabase.from("ministries").select("id,name").eq("country_code", cc),
    ]);
    const mMap = new Map((ministries ?? []).map((m) => [m.id, m.name]));
    const rows: RegisterRow[] = [];
    for (const d of decisions ?? []) rows.push({
      kind: "decision",
      id: d.id,
      title: d.title,
      status: "recorded",
      when: d.recorded_at,
      ministry_id: null,
      ministry_name: null,
      sector_code: null,
      session_id: d.session_id,
      motion_kind: d.motion_kind ?? null,
      classification: d.classification ?? null,
      overdue: false,
    });
    for (const c of commits ?? []) rows.push({
      kind: "commitment",
      id: c.id,
      title: c.title,
      status: c.status,
      when: c.due_at ?? "",
      ministry_id: c.ministry_id,
      ministry_name: c.ministry_id ? (mMap.get(c.ministry_id) ?? null) : null,
      sector_code: c.sector_code,
      session_id: null,
      motion_kind: null,
      classification: null,
      overdue: !!(c.due_at && new Date(c.due_at) < now && !["delivered","cancelled"].includes(c.status)),
    });
    return rows;
  });

export const updateCommitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["open","in_progress","delivered","blocked","cancelled"]).optional(),
    dueAt: z.string().datetime().nullable().optional(),
    successMetric: z.string().max(300).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.dueAt !== undefined) patch.due_at = data.dueAt;
    if (data.successMetric !== undefined) patch.success_metric = data.successMetric;
    const { error } = await context.supabase.from("commitments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Minutes ─────────────────────────────────────────────────────────────────

export interface MinutesData {
  session: CabinetSession;
  items: Array<AgendaItem & {
    decision?: { id: string; title: string; body: string | null; motion_kind: string | null; recorded_at: string } | null;
    vote?: { for_count: number; against_count: number; abstain_count: number; notes: string | null } | null;
    commitments: Array<{ id: string; title: string; ministry_name: string | null; due_at: string | null; status: string; success_metric: string | null }>;
  }>;
  attendance: Array<{ attendee_name: string; role: string | null; is_chair: boolean; present: boolean }>;
}

export const getMinutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MinutesData> => {
    const supa = context.supabase;
    const [{ data: s, error }, { data: items }, { data: attendance }, { data: decisions }, { data: votes }, { data: commits }, { data: ministries }] = await Promise.all([
      supa.from("cabinet_sessions").select("*").eq("id", data.sessionId).single(),
      supa.from("cabinet_agenda_items").select("*").eq("session_id", data.sessionId).order("ordinal"),
      supa.from("cabinet_attendance").select("attendee_name,role,is_chair,present").eq("session_id", data.sessionId),
      supa.from("decisions").select("id,title,body,motion_kind,recorded_at,agenda_item_id").eq("session_id", data.sessionId),
      supa.from("cabinet_votes").select("*"),
      supa.from("commitments").select("id,title,ministry_id,due_at,status,success_metric,agenda_item_id"),
      supa.from("ministries").select("id,name"),
    ]);
    if (error) throw new Error(error.message);
    const mMap = new Map((ministries ?? []).map((m) => [m.id, m.name]));
    const decMap = new Map((decisions ?? []).filter((d) => d.agenda_item_id).map((d) => [d.agenda_item_id!, d]));
    const voteMap = new Map((votes ?? []).map((v) => [v.agenda_item_id, v]));
    const commitByItem = new Map<string, MinutesData["items"][number]["commitments"]>();
    for (const c of commits ?? []) {
      if (!c.agenda_item_id) continue;
      const arr = commitByItem.get(c.agenda_item_id) ?? [];
      arr.push({
        id: c.id,
        title: c.title,
        ministry_name: c.ministry_id ? mMap.get(c.ministry_id) ?? null : null,
        due_at: c.due_at,
        status: c.status,
        success_metric: c.success_metric ?? null,
      });
      commitByItem.set(c.agenda_item_id, arr);
    }

    const session: CabinetSession = {
      id: s.id,
      title: s.title,
      classification: s.classification as Classification,
      scheduled_for: s.scheduled_for,
      held_at: s.held_at,
      closed_at: s.closed_at,
      chair_name: s.chair_name,
      chair_signed_at: s.chair_signed_at,
      agenda_count: (items ?? []).length,
    };

    return {
      session,
      attendance: attendance ?? [],
      items: (items ?? []).map((i) => ({
        ...(i as unknown as AgendaItem),
        sponsor_ministry_name: i.sponsor_ministry_id ? mMap.get(i.sponsor_ministry_id) ?? null : null,
        dossier: Array.isArray(i.dossier) ? (i.dossier as DossierRef[]) : [],
        decision: decMap.get(i.id) ? {
          id: decMap.get(i.id)!.id,
          title: decMap.get(i.id)!.title,
          body: decMap.get(i.id)!.body ?? null,
          motion_kind: decMap.get(i.id)!.motion_kind ?? null,
          recorded_at: decMap.get(i.id)!.recorded_at,
        } : null,
        vote: voteMap.get(i.id) ? {
          for_count: voteMap.get(i.id)!.for_count,
          against_count: voteMap.get(i.id)!.against_count,
          abstain_count: voteMap.get(i.id)!.abstain_count,
          notes: voteMap.get(i.id)!.notes ?? null,
        } : null,
        commitments: commitByItem.get(i.id) ?? [],
      })) as MinutesData["items"],
    };
  });

// ─── Signals inbox → agenda ──────────────────────────────────────────────────

export const addSignalToAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    countryCode: CC,
    sessionId: z.string().uuid(),
    signal: z.object({
      kind: z.enum(["narrative","strategy","scenario","grade"]),
      id: z.string(),
      title: z.string(),
      meta: z.string().nullable().optional(),
    }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const dossierRef: DossierRef = {
      kind: data.signal.kind === "strategy" ? "strategy"
        : data.signal.kind === "scenario" ? "scenario"
        : data.signal.kind === "narrative" ? "narrative"
        : "figure_snapshot",
      id: data.signal.id,
      label: data.signal.title,
    };
    const readiness = computeReadiness({ title: data.signal.title, dossier: [dossierRef] });
    const { data: existing } = await context.supabase.from("cabinet_agenda_items").select("id").eq("session_id", data.sessionId);
    const { data: inserted, error } = await context.supabase.from("cabinet_agenda_items").insert({
      session_id: data.sessionId,
      country_code: data.countryCode,
      title: data.signal.title,
      ordinal: (existing?.length ?? 0),
      time_box_min: 10,
      motion_kind: "approve",
      classification: "restricted",
      dossier: [dossierRef] as unknown as Json,
      readiness_score: readiness,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });
