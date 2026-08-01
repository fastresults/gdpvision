// @domain personas
// @tables programme_milestones,programme_deliverables,programme_phases,studies
// @ui src/components/personas/field/ProgrammeTimeline.tsx; src/components/personas/field/DeliverablesLedger.tsx

// Chamber 07 · Programme execution — milestone and deliverable state, edited
// by hand once the AI-derived plan is committed.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MILESTONE_STATUS = [
  "planned",
  "in_progress",
  "done",
  "blocked",
  "slipped",
] as const;

export const updateMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(240).optional(),
        detail: z.string().max(4_000).nullish(),
        owner: z.string().max(160).nullish(),
        due_on: z.string().date().nullish(),
        starts_on: z.string().date().nullish(),
        status: z.enum(MILESTONE_STATUS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length === 0) return { ok: true as const };
    const { error } = await context.supabase
      .from("programme_milestones")
      .update(clean as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const createMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        countryCode: z.string(),
        phaseId: z.string().uuid().nullish(),
        title: z.string().min(1).max(240),
        detail: z.string().max(4_000).nullish(),
        owner: z.string().max(160).nullish(),
        due_on: z.string().date().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("programme_milestones")
      .insert({
        plan_id: data.planId,
        country_code: data.countryCode,
        phase_id: data.phaseId ?? null,
        title: data.title,
        detail: data.detail ?? null,
        owner: data.owner ?? null,
        due_on: data.due_on ?? null,
        status: "planned",
        position: 999,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("programme_milestones")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(240).optional(),
        kind: z.string().max(60).nullish(),
        detail: z.string().max(4_000).nullish(),
        owner: z.string().max(160).nullish(),
        due_on: z.string().date().nullish(),
        status: z.enum(MILESTONE_STATUS).optional(),
        storage_path: z.string().max(600).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length === 0) return { ok: true as const };
    const { error } = await context.supabase
      .from("programme_deliverables")
      .update(clean as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const createDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        countryCode: z.string(),
        milestoneId: z.string().uuid().nullish(),
        title: z.string().min(1).max(240),
        kind: z.string().max(60).nullish(),
        due_on: z.string().date().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("programme_deliverables")
      .insert({
        plan_id: data.planId,
        country_code: data.countryCode,
        milestone_id: data.milestoneId ?? null,
        title: data.title,
        kind: data.kind ?? null,
        due_on: data.due_on ?? null,
        status: "planned",
        position: 999,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("programme_deliverables")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Live programme rollup for the masthead ─────────────────────────────────

export const getProgrammePulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), planId: z.string().uuid().nullish() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: studies } = await supabase
      .from("studies")
      .select("id,mode,method,status,title")
      .eq("project_id", data.projectId);
    const studyIds = (studies ?? []).map((s) => s.id as string);

    let invited = 0;
    let responded = 0;
    let declined = 0;
    let scheduled = 0;

    if (studyIds.length > 0) {
      const [{ data: invites }, { count: respCount }, { count: sessCount }] = await Promise.all([
        supabase.from("research_invitations").select("status").in("study_id", studyIds),
        supabase
          .from("field_responses")
          .select("id", { count: "exact", head: true })
          .in("study_id", studyIds),
        supabase
          .from("field_sessions")
          .select("id", { count: "exact", head: true })
          .in("study_id", studyIds)
          .eq("status", "scheduled"),
      ]);
      for (const i of invites ?? []) {
        const s = i.status as string;
        if (s !== "pending") invited += 1;
        if (s === "declined") declined += 1;
      }
      responded = respCount ?? 0;
      scheduled = sessCount ?? 0;
    }

    let milestones: Array<{ id: string; title: string; due_on: string | null; status: string }> = [];
    if (data.planId) {
      const { data: ms } = await supabase
        .from("programme_milestones")
        .select("id,title,due_on,status")
        .eq("plan_id", data.planId)
        .order("due_on");
      milestones = (ms ?? []) as typeof milestones;
    }

    const today = new Date().toISOString().slice(0, 10);
    const done = milestones.filter((m) => m.status === "done").length;
    const atRisk = milestones.filter(
      (m) =>
        m.status !== "done" &&
        ((m.due_on && m.due_on < today) || m.status === "blocked" || m.status === "slipped"),
    ).length;
    const next = milestones.find((m) => m.status !== "done") ?? null;

    return {
      milestonesTotal: milestones.length,
      milestonesDone: done,
      percentComplete: milestones.length ? Math.round((done / milestones.length) * 100) : 0,
      atRisk,
      next,
      studiesTotal: studies?.length ?? 0,
      fieldStudies: (studies ?? []).filter((s) => s.mode === "field").length,
      invited,
      responded,
      declined,
      scheduled,
    };
  });
