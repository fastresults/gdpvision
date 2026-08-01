// @domain personas
// @tables research_contacts,research_panels,research_panel_members,persona_projects,programme_plans
// @ui src/components/personas/field/ParticipantsStage.tsx; src/components/personas/field/RecruitmentBoard.tsx

// Chamber 07 · Stage 02 · AI-first recruitment.
//
// The chamber does not open Participants with an empty form. It derives a
// recruitment frame from the brief and the approved plan, researches real
// named individuals against each persona, and hands the admin a slate to
// accept, edit, add to or reject. Accepted people become panel members —
// a survey frame and, where the frame calls for it, focus-group slates.
//
// Identity never leaves the CRM. The corpus receives the FRAME (personas,
// targets, rationale, citations), never the people.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  ensureProgrammePanel,
  normEmail,
  RECRUITMENT_PROJECT_SELECT as ProjectSelect,
  recruitmentBriefText as briefText,
  RecruitmentPersonaShape as PersonaShape,
  type RecruitmentProjectRow as ProjectRow,
} from "./recruitment-shared";
import type { RecruitmentFrame, RecruitmentPersona } from "./recruitment-research.server";

// ── Shared reads ───────────────────────────────────────────────────────────

// ── Read the recruitment state ─────────────────────────────────────────────

export const getRecruitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("persona_projects")
      .select(ProjectSelect)
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research programme not found");
    const project = row as unknown as ProjectRow;

    const { data: people } = await supabase
      .from("research_contacts")
      .select(
        "id,full_name,email,organisation,role_title,consent_status,opted_out_at,status,persona_label,fit_reason,confidence,source_url,suggested_for,rejected_reason,project_id",
      )
      .eq("country_code", project.country_code)
      .or(`project_id.eq.${data.projectId},project_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(1_000);

    const { data: panels } = await supabase
      .from("research_panels")
      .select("id,name,kind,description,project_id")
      .eq("project_id", data.projectId);

    const panelIds = (panels ?? []).map((p) => p.id as string);
    const { data: members } = panelIds.length
      ? await supabase
          .from("research_panel_members")
          .select("panel_id,contact_id")
          .in("panel_id", panelIds)
      : { data: [] as Array<{ panel_id: string; contact_id: string }> };

    return {
      projectId: project.id,
      countryCode: project.country_code,
      title: project.title,
      frame: (project.recruitment_brief as unknown as RecruitmentFrame | null) ?? null,
      people: people ?? [],
      panels: (panels ?? []).map((p) => ({
        ...p,
        member_ids: (members ?? [])
          .filter((m) => m.panel_id === p.id)
          .map((m) => m.contact_id as string),
      })),
    };
  });

// ── Derive / save the recruitment frame ────────────────────────────────────

export const deriveRecruitmentBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ projectId: z.string().uuid(), steering: z.string().max(2_000).nullish() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("persona_projects")
      .select(ProjectSelect)
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research programme not found");
    const project = row as unknown as ProjectRow;

    const text = briefText(project);
    if (text.length < 40) {
      throw new Error("The brief is too thin to recruit from — commit the source brief first.");
    }

    const [{ data: plan }, { data: country }] = await Promise.all([
      supabase
        .from("programme_plans")
        .select("summary,method_mix,audience")
        .eq("project_id", data.projectId)
        .eq("status", "active")
        .maybeSingle(),
      supabase.from("countries").select("name").eq("code", project.country_code).maybeSingle(),
    ]);

    const { deriveRecruitmentFrame } = await import("./recruitment-research.server");
    const frame = await deriveRecruitmentFrame({
      countryName: (country?.name as string) ?? project.country_code,
      countryCode: project.country_code,
      title: project.title,
      briefText: text,
      planSummary: (plan?.summary as string | null) ?? null,
      methodMix: plan?.method_mix ?? null,
      audience: plan?.audience ?? null,
      steering: data.steering ?? null,
    });

    const { error: upErr } = await supabase
      .from("persona_projects")
      .update({ recruitment_brief: frame as unknown as Json } as never)
      .eq("id", data.projectId);
    if (upErr) throw new Error(upErr.message);

    return frame;
  });

export const saveRecruitmentBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        frame: z.object({
          summary: z.string().max(4_000),
          personas: z.array(PersonaShape).min(1).max(8),
          screening: z.array(z.string().max(300)).max(8).default([]),
          exclusions: z.array(z.string().max(300)).max(8).default([]),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const frame = { ...data.frame, derived_at: new Date().toISOString() };
    const { error } = await context.supabase
      .from("persona_projects")
      .update({ recruitment_brief: frame as unknown as Json } as never)
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return frame;
  });

// ── Deep research: one short pass at a time, resumable ─────────────────────
//
// A single long reasoning call does not survive an edge request, so the hunt
// runs as an agent loop the browser drives: pass 0 locates the registries,
// passes 1..3 extract names from small registry batches, pass 4 widens if the
// slate is thin. Every pass writes what it found and updates the run row, so
// a killed request still leaves evidence and can be resumed.

const REGISTRY_BATCH = 3;
const MAX_EXTRACT_PASSES = 3;

type RunRow = {
  id: string;
  pass: number;
  want: number;
  found: number;
  proposed: number;
  registries: unknown;
  sources: unknown;
  notes: unknown;
};

export const researchCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        personaLabel: z.string().min(1).max(80),
        want: z.number().int().min(2).max(40).optional(),
        restart: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("persona_projects")
      .select(ProjectSelect)
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research programme not found");
    const project = row as unknown as ProjectRow;

    const frame = project.recruitment_brief as unknown as RecruitmentFrame | null;
    const persona = frame?.personas?.find((p) => p.label === data.personaLabel);
    if (!persona) throw new Error("That persona is not in the recruitment frame.");

    const { data: country } = await supabase
      .from("countries")
      .select("name")
      .eq("code", project.country_code)
      .maybeSingle();
    const countryName = (country?.name as string) ?? project.country_code;
    const want = data.want ?? Math.min(persona.survey_target, 12);

    // ── The run record ────────────────────────────────────────────────────
    const { data: openRuns } = await supabase
      .from("research_recruitment_runs")
      .select("id,pass,want,found,proposed,registries,sources,notes")
      .eq("project_id", data.projectId)
      .eq("persona_label", persona.label)
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1);

    let run = (openRuns?.[0] ?? null) as RunRow | null;
    if (run && data.restart) {
      await supabase
        .from("research_recruitment_runs")
        .update({ status: "superseded" } as never)
        .eq("id", run.id);
      run = null;
    }
    if (!run) {
      const { data: created, error: runErr } = await supabase
        .from("research_recruitment_runs")
        .insert({
          country_code: project.country_code,
          project_id: data.projectId,
          persona_label: persona.label,
          status: "running",
          pass: 0,
          want,
          created_by: userId,
        } as never)
        .select("id,pass,want,found,proposed,registries,sources,notes")
        .single();
      if (runErr) throw new Error(runErr.message);
      run = created as unknown as RunRow;
    }

    const registries = Array.isArray(run.registries)
      ? (run.registries as Array<{ url: string; what?: string }>)
      : [];
    const sources = Array.isArray(run.sources) ? (run.sources as string[]) : [];
    const notes = Array.isArray(run.notes) ? (run.notes as string[]) : [];
    const pass = run.pass ?? 0;

    const close = async (status: "complete" | "thin" | "failed", err?: string) =>
      supabase
        .from("research_recruitment_runs")
        .update({
          status,
          error: err ?? null,
          notes: notes.slice(-12) as never,
          sources: sources.slice(0, 60) as never,
        } as never)
        .eq("id", run.id);

    const question = briefText(project).slice(0, 2_000);
    const log = (msg: string, extra?: Record<string, unknown>) =>
      console.info(
        `[recruit] ${project.country_code} · ${project.title.slice(0, 40)} · ${persona.label} · pass ${pass} · ${msg}`,
        extra ?? {},
      );

    // ── Pass 0 · locate the registries ────────────────────────────────────
    if (pass === 0) {
      try {
        const { findPersonaRegistries } = await import("./recruitment-research.server");
        const res = await findPersonaRegistries({
          countryName,
          programmeTitle: project.title,
          persona,
        });
        for (const c of res.citations) if (!sources.includes(c.url)) sources.push(c.url);
        notes.push(...res.notes);
        log("registries located", { count: res.registries.length });

        if (res.registries.length === 0) {
          // Nothing to read — go straight to the widened sweep.
          await supabase
            .from("research_recruitment_runs")
            .update({ pass: MAX_EXTRACT_PASSES + 1, notes: notes as never, sources: sources as never } as never)
            .eq("id", run.id);
          return {
            done: false,
            persona: persona.label,
            pass: MAX_EXTRACT_PASSES + 1,
            label: "No registries found — widening the search",
            proposed: 0,
            totalProposed: run.proposed,
            want,
            status: "running" as const,
            notes,
            sources: sources.slice(0, 20),
          };
        }

        await supabase
          .from("research_recruitment_runs")
          .update({
            pass: 1,
            registries: res.registries as never,
            sources: sources as never,
            notes: notes as never,
          } as never)
          .eq("id", run.id);

        return {
          done: false,
          persona: persona.label,
          pass: 1,
          label: `${res.registries.length} public listings located — reading them for names`,
          proposed: 0,
          totalProposed: run.proposed,
          want,
          status: "running" as const,
          notes,
          sources: sources.slice(0, 20),
        };
      } catch (e) {
        const msg = (e as Error).message.slice(0, 400);
        notes.push(`Registry pass failed — ${msg}`);
        await close("failed", msg);
        throw new Error(`Could not locate public listings for ${persona.label}: ${msg}`);
      }
    }

    // ── Everyone already known, so no pass re-proposes a person ───────────
    const { data: known } = await supabase
      .from("research_contacts")
      .select("full_name,email_norm")
      .eq("country_code", project.country_code)
      .limit(1_000);
    const exclude = (known ?? []).map((k) => String(k.full_name));
    const knownEmails = new Set(
      (known ?? []).map((k) => k.email_norm).filter((e): e is string => !!e),
    );

    const remaining = Math.max(2, want - run.proposed);
    const target: RecruitmentPersona = persona;
    let result: { candidates: Awaited<ReturnType<typeof runExtract>>["candidates"]; notes: string[] };
    let label = "Extraction";

    async function runExtract(batch: Array<{ url: string; what?: string }>) {
      const { extractCandidatesFromRegistries } = await import("./recruitment-research.server");
      return extractCandidatesFromRegistries({
        countryName,
        programmeTitle: project.title,
        question,
        persona: target,
        registries: batch.map((r) => ({ url: r.url, what: r.what ?? "" })),
        want: remaining,
        exclude,
      });
    }


    try {
      if (pass <= MAX_EXTRACT_PASSES) {
        const start = (pass - 1) * REGISTRY_BATCH;
        const batch = registries.slice(start, start + REGISTRY_BATCH);
        if (batch.length === 0) {
          // No more registries to read — fall through to the widened sweep.
          const { widenCandidateSweep } = await import("./recruitment-research.server");
          const res = await widenCandidateSweep({
            countryName,
            programmeTitle: project.title,
            question,
            persona,
            want: remaining,
            exclude,
          });
          for (const c of res.citations) if (!sources.includes(c.url)) sources.push(c.url);
          result = { candidates: res.candidates, notes: res.notes };
          label = "Widened sweep";
        } else {
          const res = await runExtract(batch);
          for (const c of res.citations) if (!sources.includes(c.url)) sources.push(c.url);
          result = { candidates: res.candidates, notes: res.notes };
          label = `Read ${batch.length} listing${batch.length === 1 ? "" : "s"}`;
        }
      } else {
        const { widenCandidateSweep } = await import("./recruitment-research.server");
        const res = await widenCandidateSweep({
          countryName,
          programmeTitle: project.title,
          question,
          persona,
          want: remaining,
          exclude,
        });
        for (const c of res.citations) if (!sources.includes(c.url)) sources.push(c.url);
        result = { candidates: res.candidates, notes: res.notes };
        label = "Widened sweep";
      }
    } catch (e) {
      const msg = (e as Error).message.slice(0, 400);
      notes.push(`${label ?? "Extraction"} failed — ${msg}`);
      await close("failed", msg);
      throw new Error(`Research pass failed for ${persona.label}: ${msg}`);
    }

    notes.push(...result.notes);

    // ── Persist the people this pass found ────────────────────────────────
    const runId = `rec_${run.id.slice(0, 8)}_p${pass}`;
    let proposed = 0;
    for (const c of result.candidates) {
      const em = normEmail(c.email);
      if (em && knownEmails.has(em)) continue;
      const { error: insErr } = await supabase.from("research_contacts").insert({
        country_code: project.country_code,
        project_id: data.projectId,
        full_name: c.full_name,
        email: c.email,
        email_norm: em,
        phone: null,
        phone_norm: null,
        organisation: c.organisation,
        role_title: c.role_title,
        tags: [persona.label],
        source: "ai_research",
        consent_status: "unknown",
        status: "proposed",
        persona_label: persona.label,
        fit_reason: c.fit_reason,
        confidence: c.confidence,
        source_url: c.source_url,
        suggested_for: c.suggested_for,
        proposed_run_id: runId,
        visibility: "private",
        owner_country_code: project.country_code,
        uploaded_by: userId,
        created_by: userId,
      } as never);
      if (!insErr) {
        proposed += 1;
        if (em) knownEmails.add(em);
      }
    }

    const totalProposed = run.proposed + proposed;
    const totalFound = run.found + result.candidates.length;
    log(`${label} · ${result.candidates.length} sourced · ${proposed} new`, { totalProposed });

    const nextPass = pass + 1;
    const enough = totalProposed >= want;
    const noMoreBatches = nextPass > MAX_EXTRACT_PASSES || registries.length <= (nextPass - 1) * REGISTRY_BATCH;
    const widened = pass > MAX_EXTRACT_PASSES || label === "Widened sweep";
    const done = enough || (noMoreBatches && widened);

    await supabase
      .from("research_recruitment_runs")
      .update({
        pass: nextPass,
        found: totalFound,
        proposed: totalProposed,
        sources: sources.slice(0, 60) as never,
        notes: notes.slice(-12) as never,
        status: done ? (totalProposed > 0 ? (totalProposed >= want ? "complete" : "thin") : "thin") : "running",
      } as never)
      .eq("id", run.id);

    // ── File the frame + this run's outcome to the second brain ───────────
    if (done) {
      try {
        const { upsertMemoryObject } = await import("@/lib/corpus/writers.server");
        await upsertMemoryObject({
          scope_key: project.country_code,
          kind: "research_recruitment_frame",
          title: `Recruitment frame · ${project.title}`.slice(0, 240),
          weight: 4,
          sector_code: "cross",
          payload: {
            evidence_type: "real_world_field_research",
            synthetic: false,
            programme_id: project.id,
            programme: project.title,
            summary: frame?.summary ?? null,
            personas: frame?.personas ?? [],
            screening: frame?.screening ?? [],
            exclusions: frame?.exclusions ?? [],
            last_run: {
              persona: persona.label,
              run_id: run.id,
              passes: nextPass,
              found: totalFound,
              proposed: totalProposed,
              want,
              registries: registries.map((r) => r.url).slice(0, 20),
              sources: sources.slice(0, 40),
              notes: notes.slice(-6),
            },
            updated_at: new Date().toISOString(),
          },
        });
      } catch {
        /* corpus filing must never fail a research pass */
      }
    }

    return {
      done,
      persona: persona.label,
      pass: nextPass,
      label,
      proposed,
      totalProposed,
      found: result.candidates.length,
      want,
      status: done ? (totalProposed >= want ? ("complete" as const) : ("thin" as const)) : ("running" as const),
      notes: notes.slice(-6),
      sources: sources.slice(0, 20),
    };
  });

// ── Accept / reject / edit / add ───────────────────────────────────────────

export const acceptCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        ids: z.array(z.string().uuid()).max(500).optional(),
        personaLabel: z.string().max(80).nullish(),
        all: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let q = supabase
      .from("research_contacts")
      .select("id,full_name,suggested_for,country_code")
      .eq("project_id", data.projectId)
      .eq("status", "proposed");
    if (data.ids?.length) q = q.in("id", data.ids);
    else if (data.personaLabel) q = q.eq("persona_label", data.personaLabel);
    else if (!data.all) throw new Error("Nothing selected to accept.");

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return { accepted: 0, survey: 0, focus: 0 };

    const countryCode = String(list[0].country_code);
    const ids = list.map((r) => r.id as string);
    const { error: upErr } = await supabase
      .from("research_contacts")
      .update({ status: "accepted", rejected_reason: null } as never)
      .in("id", ids);
    if (upErr) throw new Error(upErr.message);

    const surveyIds = list
      .filter((r) => ((r.suggested_for as string[] | null) ?? ["survey"]).includes("survey"))
      .map((r) => r.id as string);
    const focusIds = list
      .filter((r) => ((r.suggested_for as string[] | null) ?? []).includes("focus_group"))
      .map((r) => r.id as string);

    const link = async (kind: "survey" | "focus_group", memberIds: string[], name: string) => {
      if (memberIds.length === 0) return;
      const panelId = await ensureProgrammePanel(supabase as never, {
        countryCode,
        projectId: data.projectId,
        kind,
        name,
      });
      await supabase.from("research_panel_members").upsert(
        memberIds.map((cid) => ({
          panel_id: panelId,
          contact_id: cid,
          country_code: countryCode,
        })) as never,
        { onConflict: "panel_id,contact_id" },
      );
    };

    await link("survey", surveyIds, "Survey frame");
    await link("focus_group", focusIds, "Focus group slate");

    return { accepted: ids.length, survey: surveyIds.length, focus: focusIds.length };
  });

export const rejectCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), reason: z.string().max(400).nullish(), hard: z.boolean().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.hard) {
      const { error } = await supabase.from("research_contacts").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, deleted: true };
    }
    const { error } = await supabase
      .from("research_contacts")
      .update({
        status: "rejected",
        rejected_reason: data.reason ?? "Rejected by the admin.",
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Members of a panel should not survive a rejection.
    await supabase.from("research_panel_members").delete().eq("contact_id", data.id);
    return { ok: true as const, deleted: false };
  });

export const updateCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          full_name: z.string().trim().min(2).max(160).optional(),
          email: z.string().trim().max(255).nullish(),
          organisation: z.string().max(200).nullish(),
          role_title: z.string().max(200).nullish(),
          persona_label: z.string().max(80).nullish(),
          fit_reason: z.string().max(600).nullish(),
          notes: z.string().max(4_000).nullish(),
          suggested_for: z.array(z.enum(["survey", "focus_group"])).max(2).optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = data.patch;
    const payload: Record<string, unknown> = { ...p };
    if (p.email !== undefined) payload["email_norm"] = normEmail(p.email);
    const { error } = await context.supabase
      .from("research_contacts")
      .update(payload as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const addParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        countryCode: z.string(),
        full_name: z.string().trim().min(2).max(160),
        email: z.string().trim().max(255).nullish(),
        organisation: z.string().max(200).nullish(),
        role_title: z.string().max(200).nullish(),
        persona_label: z.string().max(80).nullish(),
        suggested_for: z.array(z.enum(["survey", "focus_group"])).max(2).default(["survey"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("research_contacts")
      .insert({
        country_code: data.countryCode,
        project_id: data.projectId,
        full_name: data.full_name,
        email: data.email ?? null,
        email_norm: normEmail(data.email),
        organisation: data.organisation ?? null,
        role_title: data.role_title ?? null,
        persona_label: data.persona_label ?? null,
        fit_reason: "Added by the programme owner.",
        confidence: "high",
        suggested_for: data.suggested_for,
        status: "proposed",
        source: "manual",
        consent_status: "unknown",
        visibility: "private",
        owner_country_code: data.countryCode,
        uploaded_by: userId,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ── Focus-group composition ────────────────────────────────────────────────

export const composeFocusGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ projectId: z.string().uuid(), groupSize: z.number().int().min(3).max(12).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("persona_projects")
      .select(ProjectSelect)
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Research programme not found");
    const project = row as unknown as ProjectRow;

    const { data: people, error: peopleError } = await supabase
      .from("research_contacts")
      .select("id,full_name,role_title,organisation,persona_label,suggested_for,opted_out_at")
      .eq("project_id", data.projectId)
      .eq("status", "accepted")
      .limit(200);
    if (peopleError) throw new Error(peopleError.message);

    // Prefer people explicitly marked for a group; otherwise seat any accepted
    // participant who has not opted out, so composition never dead-ends.
    const available = (people ?? []).filter((p) => !p.opted_out_at);
    const marked = available.filter((p) =>
      ((p.suggested_for as string[] | null) ?? []).includes("focus_group"),
    );
    const eligible = marked.length >= 3 ? marked : available;
    if (eligible.length < 3) {
      return {
        ok: false as const,
        groups: 0,
        seated: 0,
        accepted: eligible.length,
        required: 3,
        message:
          eligible.length === 0
            ? "Research candidates, then accept at least 3 before composing a focus group."
            : `Accept ${3 - eligible.length} more participant${3 - eligible.length === 1 ? "" : "s"} before composing a focus group.`,
      };
    }


    const { composeGroups } = await import("./recruitment-research.server");
    const groups = await composeGroups({
      programmeTitle: project.title,
      question: briefText(project).slice(0, 1_500),
      people: eligible.map((p) => ({
        id: p.id as string,
        name: String(p.full_name),
        role: (p.role_title as string | null) ?? null,
        org: (p.organisation as string | null) ?? null,
        persona: (p.persona_label as string | null) ?? null,
      })),
      groupSize: data.groupSize ?? 7,
    });

    // Replace the programme's focus-group panels with the composed slates.
    const { data: old } = await supabase
      .from("research_panels")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("kind", "focus_group");
    for (const o of old ?? []) {
      await supabase.from("research_panels").delete().eq("id", o.id as string);
    }

    for (const g of groups) {
      const { data: panel, error: pErr } = await supabase
        .from("research_panels")
        .insert({
          country_code: project.country_code,
          project_id: data.projectId,
          kind: "focus_group",
          name: g.name.slice(0, 160),
          description: g.rationale.slice(0, 2_000),
        } as never)
        .select("id")
        .single();
      if (pErr) continue;
      await supabase.from("research_panel_members").insert(
        g.members.map((cid) => ({
          panel_id: panel.id as string,
          contact_id: cid,
          country_code: project.country_code,
        })) as never,
      );
    }

    return {
      ok: true as const,
      groups: groups.length,
      seated: groups.reduce((n, g) => n + g.members.length, 0),
      accepted: eligible.length,
      required: 3,
      message: `${groups.length} focus group${groups.length === 1 ? "" : "s"} composed.`,
    };
  });
