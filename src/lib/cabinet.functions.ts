// @domain core
// @tables cabinet_agenda_items,cabinet_attendance,cabinet_brief_cache,cabinet_sessions,cabinet_votes,commitments,countries,country_kpis,country_sectors,decisions,dossier_questions,fdi_strategies,fdi_threats,grade_alerts,intake_items,ministries,ministry_profiles,scenarios
// @ui src/components/cabinet/CommitmentsCockpit.tsx; src/components/cabinet/DecisionQueue.tsx; src/components/cabinet/MinistryReadinessMatrix.tsx

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
      dossier: Array.isArray(i.dossier) ? (i.dossier as unknown as DossierRef[]) : [],
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
      ? (item.dossier as unknown as DossierRef[]).map((d, i) => `[${i+1}] ${d.kind}: ${d.label}${d.href ? " ("+d.href+")" : ""}`).join("\n")
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
    const patch: {
      status?: "open"|"in_progress"|"delivered"|"blocked"|"cancelled";
      due_at?: string | null;
      success_metric?: string | null;
    } = {};
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
        dossier: Array.isArray(i.dossier) ? (i.dossier as unknown as DossierRef[]) : [],
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

// ─── Decision Queue (ranked, deduped) ────────────────────────────────────────

export type DecisionSourceKind = "narrative" | "grade" | "strategy" | "scenario" | "threat" | "dossier_question";

export interface DecisionCard {
  key: string;
  kind: DecisionSourceKind;
  refId: string;
  title: string;
  hint: string;
  priority: string | null;
  impact: number; // 0..100
  confidence: number; // 0..100
  urgency: number; // 0..100
  score: number; // composite 0..100
  sponsorMinistrySlug: string | null;
  sponsorMinistryName: string | null;
  sectorCode: string | null;
  evidence: Array<{ label: string; kind: DecisionSourceKind | "kpi" | "url"; href?: string }>;
  createdAt: string;
}

export const getDecisionQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<DecisionCard[]> => {
    const cc = data.countryCode;
    const supa = context.supabase;
    const now = Date.now();
    const [signals, alerts, strategies, scenarios, threats, questions, ministries] = await Promise.all([
      supa.from("intake_items").select("id,topic,severity,scope_key,created_at,sector_code").eq("scope_key", cc).gte("severity", 3).is("story_key", null).order("created_at",{ascending:false}).limit(30),
      supa.from("grade_alerts").select("id,sector_code,previous_grade,new_grade,created_at").eq("country_code", cc).is("acknowledged_at", null).order("created_at",{ascending:false}).limit(15),
      supa.from("fdi_strategies").select("id,name,status,updated_at").eq("country_code", cc).eq("status","draft").order("updated_at",{ascending:false}).limit(15),
      supa.from("scenarios").select("id,title,status,updated_at").eq("country_code", cc).order("updated_at",{ascending:false}).limit(15),
      supa.from("fdi_threats").select("id,name,severity_pct,horizon_years,onset,target_sector_codes,updated_at").eq("country_code", cc).order("updated_at",{ascending:false}).limit(15),
      supa.from("dossier_questions").select("id,question,created_at,sector_code,status").eq("scope_key", cc).neq("status","answered").order("created_at",{ascending:false}).limit(15),
      supa.from("ministries").select("id,slug,name").eq("country_code", cc),
    ]);

    const mins = ministries.data ?? [];
    const inferSponsor = (sector: string | null, text: string): { slug: string | null; name: string | null } => {
      if (sector) {
        const hit = mins.find((m: { slug: string; name: string }) =>
          m.slug.toLowerCase().includes(sector.toLowerCase()) ||
          m.name.toLowerCase().includes(sector.toLowerCase()));
        if (hit) return { slug: hit.slug, name: hit.name };
      }
      const lo = text.toLowerCase();
      const hit = mins.find((m: { slug: string; name: string }) => lo.includes(m.name.toLowerCase().split(" of ").pop() ?? m.name.toLowerCase()));
      return hit ? { slug: hit.slug, name: hit.name } : { slug: null, name: null };
    };

    const recencyScore = (iso: string): number => {
      const ageDays = Math.max(0, (now - new Date(iso).getTime()) / 86400000);
      return Math.max(0, Math.round(100 - ageDays * 3)); // decays over ~33 days
    };
    const gradeDelta = (from: string, to: string): number => {
      const rank = (g: string) => ({ A: 1, B: 2, C: 3, D: 4, E: 5 }[g.toUpperCase()] ?? 3);
      return Math.min(100, Math.max(0, (rank(to) - rank(from)) * 30));
    };

    const cards: DecisionCard[] = [];

    for (const s of signals.data ?? []) {
      const sponsor = inferSponsor(s.sector_code ?? null, s.topic ?? "");
      const impact = Math.min(100, ((s.severity ?? 3) as number) * 20);
      const urgency = recencyScore(s.created_at);
      cards.push({
        key: `narrative-${s.id}`, kind: "narrative", refId: s.id,
        title: s.topic ?? "Signal",
        hint: "Narrative signal awaiting cabinet triage",
        priority: `P${6 - Math.min(5, Math.max(1, (s.severity ?? 3) as number))}`,
        impact, confidence: 70, urgency,
        score: Math.round(impact * 0.5 + urgency * 0.3 + 70 * 0.2),
        sponsorMinistrySlug: sponsor.slug, sponsorMinistryName: sponsor.name,
        sectorCode: s.sector_code ?? null,
        evidence: [{ label: "Narrative signal", kind: "narrative" }],
        createdAt: s.created_at,
      });
    }
    for (const a of alerts.data ?? []) {
      const sponsor = inferSponsor(a.sector_code ?? null, a.sector_code ?? "");
      const impact = gradeDelta(a.previous_grade ?? "C", a.new_grade ?? "C");
      const urgency = recencyScore(a.created_at);
      cards.push({
        key: `grade-${a.id}`, kind: "grade", refId: a.id,
        title: `${a.sector_code ?? "Ledger"} grade ${a.previous_grade}→${a.new_grade}`,
        hint: "Data confidence dropped — verify or refresh evidence",
        priority: null,
        impact, confidence: 85, urgency,
        score: Math.round(impact * 0.6 + urgency * 0.4),
        sponsorMinistrySlug: sponsor.slug, sponsorMinistryName: sponsor.name,
        sectorCode: a.sector_code ?? null,
        evidence: [{ label: `Grade alert · ${a.sector_code ?? "ledger"}`, kind: "grade" }],
        createdAt: a.created_at,
      });
    }
    for (const t of threats.data ?? []) {
      const sectors = (t.target_sector_codes ?? []) as string[];
      const sector = sectors[0] ?? null;
      const sponsor = inferSponsor(sector, t.name ?? "");
      const impact = Math.min(100, Math.round(Number(t.severity_pct ?? 0)));
      const urgency = t.onset === "immediate" ? 90 : t.onset === "near" ? 65 : 40;
      cards.push({
        key: `threat-${t.id}`, kind: "threat", refId: t.id,
        title: t.name ?? "Threat",
        hint: `Exposure ${impact}% · onset ${t.onset ?? "n/a"} · ${t.horizon_years ?? "?"}y horizon`,
        priority: impact >= 60 ? "P1" : impact >= 40 ? "P2" : "P3",
        impact, confidence: 75, urgency,
        score: Math.round(impact * 0.6 + urgency * 0.4),
        sponsorMinistrySlug: sponsor.slug, sponsorMinistryName: sponsor.name,
        sectorCode: sector,
        evidence: [{ label: "FDI threat brief", kind: "threat" }],
        createdAt: t.updated_at,
      });
    }
    for (const s of strategies.data ?? []) {
      const urgency = recencyScore(s.updated_at);
      cards.push({
        key: `strategy-${s.id}`, kind: "strategy", refId: s.id,
        title: s.name, hint: "Draft strategy pending cabinet approval",
        priority: "P2", impact: 60, confidence: 65, urgency,
        score: Math.round(60 * 0.5 + urgency * 0.3 + 65 * 0.2),
        sponsorMinistrySlug: null, sponsorMinistryName: null, sectorCode: null,
        evidence: [{ label: "Studio strategy", kind: "strategy" }],
        createdAt: s.updated_at,
      });
    }
    for (const s of scenarios.data ?? []) {
      const urgency = recencyScore(s.updated_at);
      cards.push({
        key: `scenario-${s.id}`, kind: "scenario", refId: s.id,
        title: s.title, hint: "Scenario run — consider promoting into policy",
        priority: "P3", impact: 50, confidence: 60, urgency,
        score: Math.round(50 * 0.5 + urgency * 0.3 + 60 * 0.2),
        sponsorMinistrySlug: null, sponsorMinistryName: null, sectorCode: null,
        evidence: [{ label: "Scenario projection", kind: "scenario" }],
        createdAt: s.updated_at,
      });
    }
    for (const q of (questions.data ?? []) as Array<{ id: string; question: string; created_at: string; sector_code: string | null }>) {
      const sponsor = inferSponsor(q.sector_code, q.question);
      const urgency = recencyScore(q.created_at);
      cards.push({
        key: `dossier-${q.id}`, kind: "dossier_question", refId: q.id,
        title: q.question, hint: "Open dossier question — decision needed",
        priority: "P4", impact: 35, confidence: 55, urgency,
        score: Math.round(35 * 0.4 + urgency * 0.4 + 55 * 0.2),
        sponsorMinistrySlug: sponsor.slug, sponsorMinistryName: sponsor.name,
        sectorCode: q.sector_code,
        evidence: [{ label: "Dossier question", kind: "dossier_question" }],
        createdAt: q.created_at,
      });
    }

    return cards.sort((a, b) => b.score - a.score).slice(0, 20);
  });

// ─── Ministry Readiness Matrix ───────────────────────────────────────────────

export interface MinistryReadinessRow {
  ministryId: string;
  slug: string;
  name: string;
  minister: string | null;
  hasProfile: boolean;
  openCommitments: number;
  overdueCommitments: number;
  deliveredCommitments: number;
  sponsoredAgendaItems: number;
  readiness: number; // 0..100
}

export const getMinistryReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<MinistryReadinessRow[]> => {
    const cc = data.countryCode;
    const supa = context.supabase;
    const [mins, profiles, commits, agenda] = await Promise.all([
      supa.from("ministries").select("id,slug,name").eq("country_code", cc).order("sort_order"),
      supa.from("ministry_profiles").select("ministry_slug,minister,minister_profile").eq("country_code", cc),
      supa.from("commitments").select("ministry_id,status,due_at").eq("country_code", cc),
      supa.from("cabinet_agenda_items").select("sponsor_ministry_id").eq("country_code", cc),
    ]);
    const now = new Date();
    const profMap = new Map(((profiles.data ?? []) as Array<{ ministry_slug: string; minister: string | null }>).map((p) => [p.ministry_slug, p]));
    const rows: MinistryReadinessRow[] = ((mins.data ?? []) as Array<{ id: string; slug: string; name: string }>).map((m) => {
      const cs = ((commits.data ?? []) as Array<{ ministry_id: string | null; status: string; due_at: string | null }>).filter((c) => c.ministry_id === m.id);
      const open = cs.filter((c) => !["delivered","cancelled"].includes(c.status)).length;
      const overdue = cs.filter((c) => c.due_at && new Date(c.due_at) < now && !["delivered","cancelled"].includes(c.status)).length;
      const delivered = cs.filter((c) => c.status === "delivered").length;
      const sponsored = ((agenda.data ?? []) as Array<{ sponsor_ministry_id: string | null }>).filter((a) => a.sponsor_ministry_id === m.id).length;
      const prof = profMap.get(m.slug);
      let readiness = 0;
      if (prof?.minister) readiness += 30;
      if (prof) readiness += 20;
      if (delivered > 0) readiness += Math.min(20, delivered * 5);
      if (sponsored > 0) readiness += Math.min(15, sponsored * 5);
      if (overdue === 0 && open > 0) readiness += 15;
      if (overdue > 0) readiness = Math.max(0, readiness - overdue * 10);
      return {
        ministryId: m.id, slug: m.slug, name: m.name,
        minister: prof?.minister ?? null,
        hasProfile: !!prof,
        openCommitments: open, overdueCommitments: overdue, deliveredCommitments: delivered,
        sponsoredAgendaItems: sponsored,
        readiness: Math.max(0, Math.min(100, readiness)),
      };
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  });

// ─── Commitments Cockpit ─────────────────────────────────────────────────────

export interface CockpitCell { ministryId: string | null; ministryName: string; status: string; count: number }
export interface CockpitData {
  cells: CockpitCell[];
  ageingBuckets: Array<{ bucket: string; count: number }>;
  breaches: Array<{ id: string; title: string; ministryName: string | null; dueAt: string | null; daysOverdue: number }>;
  medianCloseDays: number | null;
  totals: Record<string, number>;
}

export const getCommitmentsCockpit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<CockpitData> => {
    const cc = data.countryCode;
    const supa = context.supabase;
    const [{ data: commits }, { data: mins }] = await Promise.all([
      supa.from("commitments").select("id,title,status,due_at,ministry_id,created_at").eq("country_code", cc),
      supa.from("ministries").select("id,name").eq("country_code", cc),
    ]);
    const mMap = new Map(((mins ?? []) as Array<{ id: string; name: string }>).map((m) => [m.id, m.name]));
    const now = new Date();
    const cellMap = new Map<string, CockpitCell>();
    const totals: Record<string, number> = { open: 0, in_progress: 0, delivered: 0, blocked: 0, cancelled: 0 };
    const ageBuckets = { "<30d": 0, "30–90d": 0, "90–180d": 0, ">180d": 0 } as Record<string, number>;
    const breaches: CockpitData["breaches"] = [];
    const closedAges: number[] = [];

    for (const c of (commits ?? []) as Array<{ id: string; title: string; status: string; due_at: string | null; ministry_id: string | null; created_at: string }>) {
      totals[c.status] = (totals[c.status] ?? 0) + 1;
      const mName = c.ministry_id ? (mMap.get(c.ministry_id) ?? "Unassigned") : "Unassigned";
      const key = `${c.ministry_id ?? "none"}::${c.status}`;
      const cell = cellMap.get(key) ?? { ministryId: c.ministry_id, ministryName: mName, status: c.status, count: 0 };
      cell.count += 1;
      cellMap.set(key, cell);

      if (["delivered","cancelled"].includes(c.status)) {
        if (c.created_at && c.due_at) {
          closedAges.push((new Date(c.due_at).getTime() - new Date(c.created_at).getTime()) / 86400000);
        }
      } else {
        const ageDays = (now.getTime() - new Date(c.created_at).getTime()) / 86400000;
        if (ageDays < 30) ageBuckets["<30d"] += 1;
        else if (ageDays < 90) ageBuckets["30–90d"] += 1;
        else if (ageDays < 180) ageBuckets["90–180d"] += 1;
        else ageBuckets[">180d"] += 1;

        if (c.due_at && new Date(c.due_at) < now) {
          const overdue = Math.round((now.getTime() - new Date(c.due_at).getTime()) / 86400000);
          breaches.push({ id: c.id, title: c.title, ministryName: mName, dueAt: c.due_at, daysOverdue: overdue });
        }
      }
    }

    return {
      cells: [...cellMap.values()].sort((a, b) => a.ministryName.localeCompare(b.ministryName)),
      ageingBuckets: Object.entries(ageBuckets).map(([bucket, count]) => ({ bucket, count })),
      breaches: breaches.sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 8),
      medianCloseDays: closedAges.length ? Math.round(median(closedAges)) : null,
      totals,
    };
  });

// ─── Situation Brief (Gemini, McKinsey pyramid) ──────────────────────────────

export interface SituationBrief {
  id: string;
  headline: string;
  briefMd: string;
  posture: Record<string, string>;
  citations: Array<{ n: number; label: string; kind: string; href?: string }>;
  generatedAt: string;
  model: string | null;
}

export const getSituationBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<SituationBrief | null> => {
    const { data: row } = await context.supabase
      .from("cabinet_brief_cache")
      .select("id,headline,brief_md,posture,citations,generated_at,model")
      .eq("country_code", data.countryCode)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id, headline: row.headline ?? "",
      briefMd: row.brief_md,
      posture: (row.posture ?? {}) as Record<string, string>,
      citations: Array.isArray(row.citations) ? (row.citations as unknown as SituationBrief["citations"]) : [],
      generatedAt: row.generated_at, model: row.model,
    };
  });

export const generateSituationBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<SituationBrief> => {
    const cc = data.countryCode;
    const supa = context.supabase;
    const [country, kpis, sectors, signals, alerts, threats, commits] = await Promise.all([
      supa.from("countries").select("code,name").eq("code", cc).maybeSingle(),
      supa.from("country_kpis").select("kpi_code,label,latest_value,latest_period,target,unit,direction").eq("country_code", cc).limit(30),
      supa.from("country_sectors").select("sector_code,share_pct,confidence_grade").eq("country_code", cc).order("share_pct",{ascending:false}).limit(8),
      supa.from("intake_items").select("topic,severity,created_at").eq("scope_key", cc).gte("severity", 3).is("story_key", null).order("created_at",{ascending:false}).limit(6),
      supa.from("grade_alerts").select("sector_code,previous_grade,new_grade,created_at").eq("country_code", cc).is("acknowledged_at", null).order("created_at",{ascending:false}).limit(5),
      supa.from("fdi_threats").select("name,severity_pct,onset,horizon_years").eq("country_code", cc).order("severity_pct",{ascending:false}).limit(5),
      supa.from("commitments").select("title,status,due_at").eq("country_code", cc).in("status", ["open","in_progress","blocked"]).limit(15),
    ]);

    type Cite = { n: number; label: string; kind: string; href?: string };
    const citations: Cite[] = [];
    const cite = (kind: string, label: string, href?: string) => {
      const n = citations.length + 1;
      citations.push({ n, label, kind, href });
      return n;
    };

    const now = new Date();
    const overdue = ((commits.data ?? []) as Array<{ status: string; due_at: string | null }>).filter((c) => c.due_at && new Date(c.due_at) < now && !["delivered","cancelled"].includes(c.status)).length;

    const kpiLines = ((kpis.data ?? []) as Array<{ kpi_code: string; label: string; latest_value: number | null; latest_period: string | null; target: number | null; unit: string }>)
      .slice(0, 8)
      .map((k) => `[${cite("kpi", `${k.label} ${k.latest_value ?? "—"} ${k.unit} (${k.latest_period ?? "n/a"})`)}] ${k.label}: ${k.latest_value ?? "—"} ${k.unit}${k.target != null ? ` vs target ${k.target}` : ""}`).join("\n");
    const sectorLines = ((sectors.data ?? []) as Array<{ sector_code: string; share_pct: number; confidence_grade: string }>)
      .map((s) => `[${cite("sector", `${s.sector_code} share ${s.share_pct}% (grade ${s.confidence_grade})`)}] ${s.sector_code}: ${s.share_pct}% of GDP (grade ${s.confidence_grade})`).join("\n");
    const signalLines = ((signals.data ?? []) as Array<{ topic: string; severity: number; created_at: string }>)
      .map((s) => `[${cite("narrative", s.topic)}] P${6 - Math.min(5, s.severity)}: ${s.topic}`).join("\n");
    const gradeLines = ((alerts.data ?? []) as Array<{ sector_code: string | null; previous_grade: string; new_grade: string }>)
      .map((a) => `[${cite("grade", `${a.sector_code ?? "ledger"} ${a.previous_grade}→${a.new_grade}`)}] ${a.sector_code ?? "Ledger"} grade ${a.previous_grade}→${a.new_grade}`).join("\n");
    const threatLines = ((threats.data ?? []) as Array<{ name: string; severity_pct: number; onset: string; horizon_years: number }>)
      .map((t) => `[${cite("threat", `${t.name} sev ${t.severity_pct}% onset ${t.onset}`)}] ${t.name}: severity ${t.severity_pct}%, onset ${t.onset}, ${t.horizon_years}y`).join("\n");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const modelId = "google/gemini-2.5-flash";
    const prompt = `You are a McKinsey Senior Partner briefing a sovereign cabinet for country ${country.data?.name ?? cc}.
Write a State-of-the-Nation cabinet brief using the Pyramid Principle. Ground every claim in the evidence below via [N] citation markers. Do not invent numbers.

Return EXACTLY this structure in Markdown, no headings above H3:
### Headline
One line, ≤ 18 words, action-oriented.

### Situation
2–3 sentences on where the country stands now (macro + sector + fiscal).

### Complication
2 sentences on the specific risks or gaps forcing a decision.

### Question
One sentence: the decision cabinet must take this week.

### Recommendation
2–3 sentences with a specific ask, an owner ministry, and a success metric.

Also emit a JSON block on the last line prefixed with 'POSTURE:' containing four postures in the shape {"fiscal":"strong|watch|stressed","external":"strong|watch|stressed","social":"strong|watch|stressed","political":"strong|watch|stressed"}.

EVIDENCE
Macro KPIs:
${kpiLines || "(none committed)"}

Sectors:
${sectorLines || "(none committed)"}

Live signals:
${signalLines || "(none this week)"}

Grade alerts:
${gradeLines || "(none)"}

FDI threats:
${threatLines || "(none)"}

Operational load: ${overdue} overdue commitment(s) out of ${(commits.data ?? []).length} open.`;
    const { text } = await generateText({ model: gateway(modelId), prompt });

    // Extract posture JSON
    let posture: Record<string, string> = {};
    let briefMd = text.trim();
    const postureMatch = briefMd.match(/POSTURE:\s*(\{[^}]+\})/i);
    if (postureMatch) {
      try { posture = JSON.parse(postureMatch[1]); } catch { /* ignore */ }
      briefMd = briefMd.replace(postureMatch[0], "").trim();
    }
    const headlineMatch = briefMd.match(/###\s*Headline\s*\n([^\n]+)/i);
    const headline = headlineMatch ? headlineMatch[1].trim() : "";

    const { data: inserted, error } = await supa.from("cabinet_brief_cache").insert({
      country_code: cc,
      brief_md: briefMd,
      headline,
      posture: posture as unknown as Json,
      citations: citations as unknown as Json,
      model: modelId,
      generated_by: context.userId,
    }).select("id,generated_at").single();
    if (error) throw new Error(error.message);
    return {
      id: inserted.id, headline, briefMd, posture, citations,
      generatedAt: inserted.generated_at, model: modelId,
    };
  });

