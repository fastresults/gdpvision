// @domain core
// @tables cabinet_sessions,commitments,decisions,exports_log,exposure_index,goal_cycles,kpis,packages
// @ui src/routes/_authenticated/instrument/cabinet.index.tsx; src/routes/_authenticated/instrument/cabinet.session.tsx; src/routes/_authenticated/instrument/mandate.studio.tsx

// Phase 3 — Studio, Room & Mandate server functions.
// All authed via requireSupabaseAuth; RLS enforces country/role scoping.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const CountryInput = z.object({ countryCode: z.string().min(3).max(4) });

// ─── Studio: Gap + Packages ──────────────────────────────────────────────────

export interface GapView {
  countryCode: string;
  currentCbiSharePct: number;
  targetCbiSharePct: number;
  gapPct: number;
  packages: Array<{
    id: string;
    sector_code: string;
    name: string;
    status: string;
    target_gap_pct: number | null;
  }>;
}

export const getGap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<GapView> => {
    const { data: exposure } = await context.supabase
      .from("exposure_index")
      .select("value")
      .eq("country_code", data.countryCode)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: pkgs, error: pkgErr } = await context.supabase
      .from("packages")
      .select("id,sector_code,name,status,target_gap_pct")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false });
    if (pkgErr) throw new Error(pkgErr.message);
    const current = Number(exposure?.value ?? 0);
    const target = 15; // policy anchor
    return {
      countryCode: data.countryCode,
      currentCbiSharePct: current,
      targetCbiSharePct: target,
      gapPct: Math.max(0, current - target),
      packages: (pkgs ?? []).map((p) => ({
        id: p.id,
        sector_code: p.sector_code,
        name: p.name,
        status: p.status,
        target_gap_pct: p.target_gap_pct === null ? null : Number(p.target_gap_pct),
      })),
    };
  });

const PackageSaveInput = z.object({
  countryCode: z.string().min(3).max(4),
  sectorCode: z.string().min(2).max(32),
  name: z.string().min(1).max(160),
  summary: z.string().max(2000).optional(),
  gates: z.array(z.object({ label: z.string(), passed: z.boolean() })).default([]),
  enablingActions: z
    .array(z.object({ label: z.string(), owner: z.string().optional() }))
    .default([]),
  targetGapPct: z.number().min(0).max(100).optional(),
  status: z.enum(["draft", "proposed", "approved", "active", "complete"]).default("draft"),
});

export const savePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PackageSaveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("packages")
      .insert({
        country_code: data.countryCode,
        sector_code: data.sectorCode,
        name: data.name,
        summary: data.summary ?? null,
        gates: data.gates as unknown as Json,
        enabling_actions: data.enablingActions as unknown as Json,
        target_gap_pct: data.targetGapPct ?? null,
        status: data.status,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ─── Mandate: KPIs + Scorecard ───────────────────────────────────────────────

export interface KpiRow {
  id: string;
  sector_code: string;
  metric: string;
  unit: string;
  baseline: number | null;
  target: number;
  target_period: string | null;
  cadence: string;
  classification: string;
  ministry_id: string | null;
  baseline_period: string | null;
  direction: string;
  target_basis: string | null;
  evidence_url: string | null;
  warning_tolerance_pct: number;
  critical_tolerance_pct: number;
  verification_status: string;
  latest?: { period: string; value: number | null; status: string } | null;
}

export const listKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<KpiRow[]> => {
    const { data: kpis, error } = await context.supabase
      .from("kpis")
      .select(
        "id,sector_code,metric,unit,baseline,target,target_period,cadence,classification,ministry_id,baseline_period,direction,target_basis,evidence_url,warning_tolerance_pct,critical_tolerance_pct,verification_status",
      )
      .eq("country_code", data.countryCode)
      .order("sector_code", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (kpis ?? []).map((k) => k.id);
    const latestByKpi = new Map<string, { period: string; value: number | null; status: string }>();
    if (ids.length) {
      const { data: cycles } = await context.supabase
        .from("goal_cycles")
        .select("kpi_id,period,status,figures,snapshot_at")
        .in("kpi_id", ids)
        .order("snapshot_at", { ascending: false });
      for (const c of cycles ?? []) {
        if (latestByKpi.has(c.kpi_id)) continue;
        const figures = (c.figures ?? {}) as { actual?: number };
        latestByKpi.set(c.kpi_id, {
          period: c.period,
          value: typeof figures.actual === "number" ? figures.actual : null,
          status: c.status,
        });
      }
    }
    return (kpis ?? []).map((k) => ({
      id: k.id,
      sector_code: k.sector_code,
      metric: k.metric,
      unit: k.unit,
      baseline: k.baseline === null ? null : Number(k.baseline),
      target: Number(k.target),
      target_period: k.target_period,
      cadence: k.cadence,
      classification: k.classification,
      ministry_id: k.ministry_id,
      baseline_period: k.baseline_period,
      direction: k.direction,
      target_basis: k.target_basis,
      evidence_url: k.evidence_url,
      warning_tolerance_pct: Number(k.warning_tolerance_pct),
      critical_tolerance_pct: Number(k.critical_tolerance_pct),
      verification_status: k.verification_status,
      latest: latestByKpi.get(k.id) ?? null,
    }));
  });

const KpiSaveInput = z.object({
  countryCode: z.string().min(3).max(4),
  sectorCode: z.string().min(2).max(32),
  metric: z.string().min(1).max(200),
  unit: z.string().min(1).max(32),
  baseline: z.number().optional(),
  target: z.number(),
  targetPeriod: z.string().optional(),
  cadence: z.enum(["monthly", "quarterly", "annual"]).default("quarterly"),
  classification: z.enum(["public", "internal", "restricted"]).default("internal"),
  ministryId: z.string().uuid().optional(),
  planScenarioId: z.string().uuid().optional(),
  baselinePeriod: z.string().min(4),
  direction: z.enum(["up", "down", "flat"]),
  targetBasis: z.enum(["policy_commitment", "peer_benchmark", "approved_scenario"]),
  evidenceUrl: z.string().url(),
  warningTolerancePct: z.number().min(0).max(100).default(10),
  criticalTolerancePct: z.number().min(0).max(100).default(20),
});

export const saveKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => KpiSaveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kpis")
      .insert({
        country_code: data.countryCode,
        sector_code: data.sectorCode,
        metric: data.metric,
        unit: data.unit,
        baseline: data.baseline ?? null,
        target: data.target,
        target_period: data.targetPeriod ?? null,
        cadence: data.cadence,
        classification: data.classification,
        ministry_id: data.ministryId ?? null,
        plan_scenario_id: data.planScenarioId ?? null,
        owner_id: context.userId,
        baseline_period: data.baselinePeriod,
        direction: data.direction,
        target_basis: data.targetBasis,
        evidence_url: data.evidenceUrl,
        warning_tolerance_pct: data.warningTolerancePct,
        critical_tolerance_pct: data.criticalTolerancePct,
        verification_status: "submitted",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const RecordActualInput = z.object({
  kpiId: z.string().uuid(),
  period: z.string().min(4).max(40),
  actual: z.number(),
  commentary: z.string().max(2000).optional(),
});

export const recordKpiActual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RecordActualInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goal_cycles").upsert(
      {
        kpi_id: data.kpiId,
        period: data.period,
        figures: { actual: data.actual } as Json,
        commentary: data.commentary ?? null,
        status: "reported",
        created_by: context.userId,
      },
      { onConflict: "kpi_id,period" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const QualifyKpiInput = z.object({
  kpiId: z.string().uuid(),
  note: z.string().max(1000).optional(),
});

export const qualifyKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => QualifyKpiInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: current, error: readError } = await context.supabase
      .from("kpis")
      .select("owner_id,verification_status")
      .eq("id", data.kpiId)
      .single();
    if (readError) throw new Error(readError.message);
    if (current.owner_id === context.userId)
      throw new Error("A second authorised person must qualify this KPI");
    const { error } = await context.supabase
      .from("kpis")
      .update({
        verification_status: "qualified",
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
        qualification_notes: data.note ?? null,
      })
      .eq("id", data.kpiId)
      .eq("verification_status", "submitted");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Cabinet Room: sessions, decisions, commitments ──────────────────────────

export interface SessionRow {
  id: string;
  title: string;
  classification: string;
  scheduled_for: string | null;
  held_at: string | null;
  agenda_count: number;
}

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<SessionRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("cabinet_sessions")
      .select("id,title,classification,scheduled_for,held_at,agenda")
      .eq("country_code", data.countryCode)
      .order("scheduled_for", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      classification: r.classification,
      scheduled_for: r.scheduled_for,
      held_at: r.held_at,
      agenda_count: Array.isArray(r.agenda) ? r.agenda.length : 0,
    }));
  });

const SessionCreate = z.object({
  countryCode: z.string().min(3).max(4),
  title: z.string().min(1).max(240),
  scheduledFor: z.string().datetime().optional(),
  agenda: z.array(z.object({ item: z.string(), owner: z.string().optional() })).default([]),
  classification: z.enum(["public", "internal", "restricted", "secret"]).default("restricted"),
});

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SessionCreate.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("cabinet_sessions")
      .insert({
        country_code: data.countryCode,
        title: data.title,
        scheduled_for: data.scheduledFor ?? null,
        agenda: data.agenda as unknown as Json,
        classification: data.classification,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export interface CommitmentRow {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  owner_id: string | null;
}

export const listCommitments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<CommitmentRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("commitments")
      .select("id,title,status,due_at,owner_id")
      .eq("country_code", data.countryCode)
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CommitmentStatus = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "delivered", "blocked", "cancelled"]),
});

export const updateCommitmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CommitmentStatus.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("commitments")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DecisionRecord = z.object({
  sessionId: z.string().uuid(),
  countryCode: z.string().min(3).max(4),
  title: z.string().min(1).max(300),
  body: z.string().max(4000).optional(),
  mandateId: z.string().uuid().optional(),
  commitments: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        ownerId: z.string().uuid().optional(),
        ministryId: z.string().uuid().optional(),
        dueAt: z.string().datetime().optional(),
      }),
    )
    .default([]),
});

export const recordDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DecisionRecord.parse(data))
  .handler(async ({ data, context }) => {
    const { data: dec, error } = await context.supabase
      .from("decisions")
      .insert({
        session_id: data.sessionId,
        country_code: data.countryCode,
        title: data.title,
        body: data.body ?? null,
        mandate_id: data.mandateId ?? null,
        recorded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.commitments.length) {
      const { error: cErr } = await context.supabase.from("commitments").insert(
        data.commitments.map((c) => ({
          decision_id: dec.id,
          country_code: data.countryCode,
          title: c.title,
          owner_id: c.ownerId ?? null,
          ministry_id: c.ministryId ?? null,
          due_at: c.dueAt ?? null,
          created_by: context.userId,
        })),
      );
      if (cErr) throw new Error(cErr.message);
    }
    return { id: dec.id };
  });

// ─── Exports log ─────────────────────────────────────────────────────────────

const ExportInput = z.object({
  countryCode: z.string().min(3).max(4),
  artifactKind: z.string().min(1).max(64),
  artifactRef: z.string().max(300).optional(),
  classification: z.enum(["public", "internal", "restricted", "secret"]).default("restricted"),
});

export const logExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ExportInput.parse(data))
  .handler(async ({ data, context }) => {
    const watermark = `${data.countryCode}·${context.userId.slice(0, 8)}·${new Date().toISOString()}`;
    const { error } = await context.supabase.from("exports_log").insert({
      country_code: data.countryCode,
      artifact_kind: data.artifactKind,
      artifact_ref: data.artifactRef ?? null,
      classification: data.classification,
      watermark,
      exported_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { watermark };
  });

export const listExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("exports_log")
      .select("id,artifact_kind,artifact_ref,classification,watermark,exported_at,exported_by")
      .eq("country_code", data.countryCode)
      .order("exported_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
