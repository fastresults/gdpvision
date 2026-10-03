// @domain personas
// @tables ministry_portfolios,portfolio_skills,portfolio_persona_sets,portfolio_personas,portfolio_persona_syntheses,ministries,countries,audit_log
// @ui src/routes/_authenticated/admin/countries.$code.personas.portfolios.index.tsx; src/routes/_authenticated/admin/countries.$code.personas.portfolios.$setId.tsx
//
// Chamber 07 · Ministers track — the board, the workspace, and the
// governance actions (create, edit, submit, approve, return, withdraw,
// reopen, delete), plus ministry → portfolio mapping. Approval rules live in
// the database (drizzle/migrations/0028); these functions only ask.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError, type AnyClient } from "@/lib/syndication/db";

import {
  REFRESH_AFTER_DAYS,
  REGIONAL,
  SKILL_FAMILIES,
  hasProfile,
  officeNames,
  type IdealProfile,
  type PersonaRow,
  type PortfolioRow,
  type SetRow,
  type SetStatus,
  type SkillRow,
  type SynthesisRow,
} from "./db";

const SET_COLS =
  "id,portfolio_code,scope_key,kind,base_set_id,version,title,target_size,status,phase,run_state,lock_until,run_error,phase_log,design_matrix,context,context_hash,proposed_skills,model,created_by,submitted_by,submitted_at,approved_by,approved_at,approval_mode,returned_by,returned_at,returned_note,created_at,updated_at";

export interface Capabilities {
  /** Run, edit and submit regional profiles. */
  writeRegional: boolean;
  approveRegional: boolean;
  soleRegional: boolean;
  /** Run, edit and submit this country's overlays. */
  writeCountry: boolean;
  approveCountry: boolean;
  soleCountry: boolean;
  mapMinistries: boolean;
}

async function loadCaps(sb: AnyClient, userId: string, code: string): Promise<Capabilities> {
  const c = db(sb);
  const [wr, ar, sr, wc, ac, sc, mm] = await Promise.all([
    c.rpc("can_write_portfolio_scope", { _user_id: userId, _scope: REGIONAL }),
    c.rpc("can_approve_portfolio", { _user_id: userId, _scope: REGIONAL }),
    c.rpc("can_sole_approve_portfolio", { _user_id: userId, _scope: REGIONAL }),
    c.rpc("can_write_portfolio_scope", { _user_id: userId, _scope: code }),
    c.rpc("can_approve_portfolio", { _user_id: userId, _scope: code }),
    c.rpc("can_sole_approve_portfolio", { _user_id: userId, _scope: code }),
    c.rpc("has_country_role", {
      _user_id: userId,
      _country_code: code,
      _roles: ["country_admin", "data_steward", "cabinet_secretary"],
    }),
  ]);
  return {
    writeRegional: !!wr.data,
    approveRegional: !!ar.data,
    soleRegional: !!sr.data,
    writeCountry: !!wc.data,
    approveCountry: !!ac.data,
    soleCountry: !!sc.data,
    mapMinistries: !!mm.data,
  };
}

async function countryName(sb: AnyClient, code: string): Promise<string> {
  const { data } = await db(sb).from("countries").select("name").eq("code", code).maybeSingle();
  return ((data as { name?: string } | null)?.name ?? code).trim();
}

const aiAvailable = () => !!process.env.LOVABLE_API_KEY;

/**
 * When each portfolio's offices last changed in the government record:
 * key `<CODE>` across every country the user can see (regional profiles),
 * and `<CODE>:<COUNTRY>` for this country (overlays). Epoch ms.
 */
async function officeChanges(
  sb: AnyClient,
  portfolios: PortfolioRow[],
  code: string,
): Promise<Map<string, number>> {
  const c = db(sb);
  const [{ data: offices }, { data: mins }] = await Promise.all([
    c
      .from("government_offices")
      .select("country_code,office_key,ministry_slug,updated_at")
      .in("office_key", ["head_of_government", "leader_of_opposition", "cabinet_minister"])
      .limit(2000),
    c
      .from("ministries")
      .select("country_code,slug,portfolio_code,secondary_portfolio_codes")
      .limit(2000),
  ]);
  const byMinistry = new Map<string, string[]>();
  for (const m of (mins ?? []) as Array<{
    country_code: string;
    slug: string;
    portfolio_code: string | null;
    secondary_portfolio_codes: string[] | null;
  }>) {
    const codes = [m.portfolio_code, ...(m.secondary_portfolio_codes ?? [])].filter(
      Boolean,
    ) as string[];
    byMinistry.set(`${m.country_code}/${m.slug}`, codes);
  }
  const pm = portfolios.find((p) => p.kind === "head_of_government")?.code;
  const loo = portfolios.find((p) => p.kind === "opposition")?.code;
  const out = new Map<string, number>();
  const bump = (k: string, t: number) => out.set(k, Math.max(out.get(k) ?? 0, t));
  for (const o of (offices ?? []) as Array<{
    country_code: string;
    office_key: string;
    ministry_slug: string | null;
    updated_at: string;
  }>) {
    const t = Date.parse(o.updated_at);
    if (!Number.isFinite(t)) continue;
    const codes =
      o.office_key === "head_of_government"
        ? pm
          ? [pm]
          : []
        : o.office_key === "leader_of_opposition"
          ? loo
            ? [loo]
            : []
          : (byMinistry.get(`${o.country_code}/${o.ministry_slug ?? ""}`) ?? []);
    for (const k of codes) {
      bump(k, t);
      if (o.country_code === code) bump(`${k}:${code}`, t);
    }
  }
  return out;
}

// ------------------------------------------------------------------ board

export type SetSummary = Pick<
  SetRow,
  | "id"
  | "portfolio_code"
  | "scope_key"
  | "kind"
  | "version"
  | "title"
  | "target_size"
  | "status"
  | "phase"
  | "run_state"
  | "run_error"
  | "approval_mode"
  | "approved_at"
  | "updated_at"
> & {
  personas: number;
  hasProfile: boolean;
  /** Approved profiles only: why it is due for refresh, if it is. */
  refresh: string[];
};

export interface MappedMinistry {
  id: string;
  slug: string;
  name: string;
  portfolio_code: string | null;
  secondary_portfolio_codes: string[];
}

export interface BoardPortfolio extends PortfolioRow {
  regional: SetSummary[];
  country: SetSummary[];
  ministries: MappedMinistry[];
}

export interface BoardData {
  countryName: string;
  aiAvailable: boolean;
  researchAvailable: boolean;
  capabilities: Capabilities;
  portfolios: BoardPortfolio[];
  unmapped: MappedMinistry[];
  skills: number;
}

export const getPortfolioBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }): Promise<BoardData> => {
    const sb = context.supabase as AnyClient;
    const c = db(sb);
    const [
      caps,
      name,
      { data: ports, error: pErr },
      { data: sets },
      { data: mins },
      { count: skills },
    ] = await Promise.all([
      loadCaps(sb, context.userId, data.code),
      countryName(sb, data.code),
      c.from("ministry_portfolios").select("*").order("sort_order"),
      c
        .from("portfolio_persona_sets")
        .select(
          "id,portfolio_code,scope_key,kind,version,title,target_size,status,phase,run_state,run_error,approval_mode,approved_at,updated_at",
        )
        .in("scope_key", [REGIONAL, data.code])
        .order("version", { ascending: false }),
      c
        .from("ministries")
        .select("id,slug,name,portfolio_code,secondary_portfolio_codes")
        .eq("country_code", data.code)
        .order("sort_order"),
      c.from("portfolio_skills").select("code", { count: "exact", head: true }),
    ]);
    if (pErr) {
      if (/ministry_portfolios/.test(pErr.message))
        throw new Error(
          "The Ministers track is not installed yet: apply migration 0028_portfolio_personas, then reload.",
        );
      throw governanceError(pErr);
    }
    const ss = (sets ?? []) as Array<Omit<SetSummary, "personas" | "hasProfile" | "refresh">>;
    const ids = ss.map((s) => s.id);
    const [{ data: pc }, { data: sy }] = ids.length
      ? await Promise.all([
          c.from("portfolio_personas").select("set_id").in("set_id", ids),
          c.from("portfolio_persona_syntheses").select("set_id,profile").in("set_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const counts = new Map<string, number>();
    for (const r of (pc ?? []) as Array<{ set_id: string }>)
      counts.set(r.set_id, (counts.get(r.set_id) ?? 0) + 1);
    const profiled = new Set(
      ((sy ?? []) as Array<{ set_id: string; profile: SynthesisRow["profile"] }>)
        .filter((r) => hasProfile(r.profile))
        .map((r) => r.set_id),
    );
    const portfolioRows = (ports ?? []) as PortfolioRow[];
    const changed = await officeChanges(sb, portfolioRows, data.code);
    const now = Date.now();
    const summaries: SetSummary[] = ss.map((s) => {
      const refresh: string[] = [];
      if (s.status === "approved" && s.approved_at) {
        const at = Date.parse(s.approved_at);
        if (now - at > REFRESH_AFTER_DAYS * 86_400_000)
          refresh.push("approved more than a year ago");
        const key =
          s.scope_key === REGIONAL ? s.portfolio_code : `${s.portfolio_code}:${s.scope_key}`;
        const last = changed.get(key);
        if (last && last > at) refresh.push("an office it covers has changed since approval");
      }
      return { ...s, personas: counts.get(s.id) ?? 0, hasProfile: profiled.has(s.id), refresh };
    });
    const ministries = (mins ?? []) as MappedMinistry[];
    const portfolios = portfolioRows.map((p) => ({
      ...p,
      regional: summaries.filter((s) => s.portfolio_code === p.code && s.scope_key === REGIONAL),
      country: summaries.filter((s) => s.portfolio_code === p.code && s.scope_key === data.code),
      ministries: ministries.filter(
        (m) => m.portfolio_code === p.code || (m.secondary_portfolio_codes ?? []).includes(p.code),
      ),
    }));
    return {
      countryName: name,
      aiAvailable: aiAvailable(),
      researchAvailable: !!process.env.PERPLEXITY_API_KEY,
      capabilities: caps,
      portfolios,
      unmapped: ministries.filter((m) => !m.portfolio_code),
      skills: skills ?? 0,
    };
  });

// ------------------------------------------------------------------ create

export const createPortfolioSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        portfolio: z.string().min(2).max(8),
        scope: z.enum(["regional", "country"]),
        targetSize: z.number().int().min(10).max(50).default(50),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = context.supabase as AnyClient;
    const c = db(sb);
    const { loadPortfolio } = await import("./engine.server");
    const p = await loadPortfolio(sb, data.portfolio);
    const scopeKey = data.scope === "regional" ? REGIONAL : data.code;
    let base: string | null = null;
    if (data.scope === "country") {
      const { data: reg } = await c
        .from("portfolio_persona_sets")
        .select("id")
        .eq("portfolio_code", p.code)
        .eq("scope_key", REGIONAL)
        .eq("status", "approved")
        .maybeSingle();
      if (!reg)
        throw new Error(
          `Approve the regional ${p.label} profile first. A country overlay re-weights it for ${data.code}.`,
        );
      base = (reg as { id: string }).id;
    }
    const { data: open } = await c
      .from("portfolio_persona_sets")
      .select("id,status")
      .eq("portfolio_code", p.code)
      .eq("scope_key", scopeKey)
      .in("status", ["draft", "returned", "submitted"])
      .limit(1);
    if (open?.length)
      throw new Error(
        "A version of this profile is already in progress. Finish or delete it before starting another.",
      );

    const scopeName = data.scope === "regional" ? "Caribbean" : await countryName(sb, data.code);
    const title = `${officeNames(p).ideal} — ${scopeName}`;
    const { data: row, error } = await c
      .from("portfolio_persona_sets")
      .insert({
        portfolio_code: p.code,
        scope_key: scopeKey,
        kind: data.scope === "regional" ? "regional" : "overlay",
        base_set_id: base,
        title,
        target_size: data.scope === "regional" ? data.targetSize : 50,
      })
      .select("id")
      .single();
    if (error) throw governanceError(error);
    return { id: (row as { id: string }).id };
  });

// ------------------------------------------------------------------ workspace

export interface HistoryItem {
  id: string;
  action: string;
  actorLabel: string | null;
  note: string | null;
  mode: string | null;
  at: string;
}

export interface PmInput {
  portfolio_code: string;
  label: string;
  synthesis_id: string;
  set_id: string;
  version: number;
  approved_at: string | null;
  /** True when this approved profile is newer than the PM synthesis. */
  newer: boolean;
  used: boolean;
}

export interface WorkspaceData {
  countryName: string;
  aiAvailable: boolean;
  capabilities: Capabilities;
  canWrite: boolean;
  canApprove: boolean;
  canSoleApprove: boolean;
  set: SetRow;
  portfolio: PortfolioRow;
  portfolios: Array<Pick<PortfolioRow, "code" | "label" | "kind" | "sort_order">>;
  skills: SkillRow[];
  personas: PersonaRow[];
  synthesis: SynthesisRow | null;
  /** Overlay: the regional set it builds on. */
  base: { set: SetRow; synthesis: SynthesisRow | null } | null;
  /** Prime Minister: the approved ministry profiles in this scope. */
  pmInputs: PmInput[];
  stale: boolean;
  history: HistoryItem[];
}

export const getPortfolioSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, setId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<WorkspaceData> => {
    const sb = context.supabase as AnyClient;
    const c = db(sb);
    const E = await import("./engine.server");
    const set = await E.loadSet(sb, data.setId);
    if (set.scope_key !== REGIONAL && set.scope_key !== data.code)
      throw new Error("That profile belongs to another country.");
    const [portfolio, skills, personas, synthesis, caps, name, { data: ports }, { data: hist }] =
      await Promise.all([
        E.loadPortfolio(sb, set.portfolio_code),
        E.loadSkills(sb),
        E.loadPersonas(sb, set.id),
        E.loadSynthesis(sb, set.id),
        loadCaps(sb, context.userId, data.code),
        countryName(sb, data.code),
        c.from("ministry_portfolios").select("code,label,kind,sort_order").order("sort_order"),
        c.rpc("portfolio_profile_history", { _set_id: set.id }),
      ]);

    let base: WorkspaceData["base"] = null;
    let basePersonas: PersonaRow[] = [];
    if (set.kind === "overlay" && set.base_set_id) {
      const [bs, bsy, bp] = await Promise.all([
        E.loadSet(sb, set.base_set_id).catch(() => null),
        E.loadSynthesis(sb, set.base_set_id),
        E.loadPersonas(sb, set.base_set_id),
      ]);
      if (bs) base = { set: bs, synthesis: bsy };
      basePersonas = bp;
    }

    let pmInputs: PmInput[] = [];
    let stale = false;
    if (portfolio.kind === "head_of_government") {
      const inputs = await E.loadPmInputs(sb, set.kind === "overlay" ? REGIONAL : set.scope_key);
      const used = new Set(synthesis?.input_synthesis_ids ?? []);
      const madeAt = synthesis?.updated_at ? Date.parse(synthesis.updated_at) : 0;
      pmInputs = inputs.map((x) => ({
        portfolio_code: x.portfolio.code,
        label: x.portfolio.label,
        synthesis_id: x.synthesis.id,
        set_id: x.set.id,
        version: x.set.version,
        approved_at: x.set.approved_at,
        newer: !!madeAt && !!x.set.approved_at && Date.parse(x.set.approved_at) > madeAt,
        used: used.has(x.synthesis.id),
      }));
      stale =
        set.kind === "regional" &&
        hasProfile(synthesis?.profile) &&
        pmInputs.some((i) => i.newer || !i.used);
    }
    if (set.kind === "overlay" && synthesis && hasProfile(synthesis.profile)) {
      // Stale when the regional profile in force is not the one this overlay
      // was built from (a newer regional version has been approved since).
      const current = await E.currentRegionalSetId(sb, set.portfolio_code);
      const currentSynth = current ? await E.loadSynthesis(sb, current) : null;
      stale = !!currentSynth && !(synthesis.input_synthesis_ids ?? []).includes(currentSynth.id);
    }

    const scope = set.scope_key;
    const canWrite = scope === REGIONAL ? caps.writeRegional : caps.writeCountry;
    const canApprove = scope === REGIONAL ? caps.approveRegional : caps.approveCountry;
    const canSoleApprove = scope === REGIONAL ? caps.soleRegional : caps.soleCountry;

    return {
      countryName: name,
      aiAvailable: aiAvailable(),
      capabilities: caps,
      canWrite,
      canApprove,
      canSoleApprove,
      set,
      portfolio,
      portfolios: (ports ?? []) as WorkspaceData["portfolios"],
      skills,
      personas: set.kind === "overlay" ? basePersonas : personas,
      synthesis,
      base,
      pmInputs,
      stale,
      history: (
        (hist ?? []) as Array<{
          id: string;
          action: string;
          actor_label: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        }>
      ).map((h) => ({
        id: h.id,
        action: h.action,
        actorLabel: h.actor_label,
        note: typeof h.metadata?.note === "string" ? h.metadata.note : null,
        mode: typeof h.metadata?.mode === "string" ? h.metadata.mode : null,
        at: h.created_at,
      })),
    };
  });

// ------------------------------------------------------------------ governance

export const transitionPortfolioSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        setId: z.string().uuid(),
        action: z.enum(["submit", "approve", "return", "withdraw", "reopen"]),
        note: z.string().max(2000).optional(),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ status: SetStatus }> => {
    const c = db(context.supabase as AnyClient);
    const to: Record<typeof data.action, SetStatus> = {
      submit: "submitted",
      approve: "approved",
      return: "returned",
      withdraw: "draft",
      reopen: "draft",
    };
    const patch: Record<string, unknown> = { status: to[data.action] };
    if (data.action === "return") patch.returned_note = data.note ?? "";
    const { data: row, error } = await c
      .from("portfolio_persona_sets")
      .update(patch)
      .eq("id", data.setId)
      .select("status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("That profile was not found, or you don't have access to it.");
    return { status: (row as { status: SetStatus }).status };
  });

export const deletePortfolioSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ setId: z.string().uuid() }), d))
  .handler(async ({ data, context }) => {
    const { error } = await db(context.supabase as AnyClient)
      .from("portfolio_persona_sets")
      .delete()
      .eq("id", data.setId);
    if (error) throw governanceError(error);
    return { ok: true };
  });

const RangeIn = z.object({ low: z.number().min(0).max(100), high: z.number().min(0).max(100) });
const ProfileIn = z.object({
  title: z.string().min(3).max(200),
  summary: z.string().max(3000),
  personality: z.object({
    ocean_target: z.object({
      openness: RangeIn,
      conscientiousness: RangeIn,
      extraversion: RangeIn,
      agreeableness: RangeIn,
      neuroticism: RangeIn,
    }),
    traits: z.array(z.string().max(300)).max(20),
  }),
  values: z.array(z.string().max(200)).max(20),
  decision_model: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        weighs: z.array(z.string().max(300)).max(12),
        horizon: z.string().max(300),
        risk_posture: z.string().max(300),
        consults: z.array(z.string().max(200)).max(12),
        says_no_when: z.string().max(800),
        narrative: z.string().max(3000),
      }),
    )
    .max(12),
  skill_stack: z
    .array(
      z.object({
        code: z.string(),
        tier: z.enum(["must_have", "should_have", "differentiator"]),
        why: z.string().max(600),
      }),
    )
    .max(30),
  anti_patterns: z.array(z.string().max(400)).max(15),
  stress_behaviours: z.array(z.string().max(400)).max(15),
  country_deltas: z
    .array(z.object({ aspect: z.string(), change: z.string(), why: z.string() }))
    .max(20)
    .optional(),
  portfolio_weighting: z
    .array(
      z.object({
        portfolio_code: z.string(),
        stance: z.string().max(600),
        weight: z.number().min(1).max(5),
        arbitration_rule: z.string().max(800),
      }),
    )
    .max(25)
    .optional(),
});

/** A person edits the profile. Edits are recorded on the synthesis. */
export const savePortfolioProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        setId: z.string().uuid(),
        profile: ProfileIn,
        narrative_md: z.string().max(12000),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase as AnyClient);
    const { data: skills } = await c.from("portfolio_skills").select("code");
    const valid = new Set(((skills ?? []) as Array<{ code: string }>).map((s) => s.code));
    const profile: IdealProfile = {
      ...data.profile,
      skill_stack: data.profile.skill_stack.filter((s) => valid.has(s.code)),
    };
    const { data: row, error } = await c
      .from("portfolio_persona_syntheses")
      .update({
        profile,
        narrative_md: data.narrative_md,
        edited_by: context.userId,
        edited_at: new Date().toISOString(),
      })
      .eq("set_id", data.setId)
      .select("id")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("Synthesise the profile before editing it.");
    return { ok: true };
  });

/** Changes one matrix cell before its slot has been cast. */
export const updateMatrixCell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        setId: z.string().uuid(),
        slot: z.number().int().min(1).max(50),
        cell: z.record(z.string(), z.string().max(200)),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnyClient;
    const c = db(sb);
    const { loadSet } = await import("./engine.server");
    const set = await loadSet(sb, data.setId);
    const m = set.design_matrix as {
      axes?: unknown[];
      cells?: Array<{ slot: number; cell: Record<string, string> }>;
    };
    if (!m.cells?.length) throw new Error("The design matrix has not been built yet.");
    const { count } = await c
      .from("portfolio_personas")
      .select("id", { count: "exact", head: true })
      .eq("set_id", set.id)
      .eq("slot_index", data.slot);
    if (count) throw new Error("That slot has been cast. Regenerate it to apply a new cell.");
    const cells = m.cells.map((x) =>
      x.slot === data.slot ? { ...x, cell: { ...x.cell, ...data.cell } } : x,
    );
    const { error } = await c
      .from("portfolio_persona_sets")
      .update({ design_matrix: { ...m, cells } })
      .eq("id", set.id);
    if (error) throw governanceError(error);
    return { ok: true };
  });

/** Promotes a skill the model proposed into the taxonomy (global admins). */
export const promoteProposedSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        setId: z.string().uuid(),
        label: z.string().min(3).max(120),
        family: z.enum(SKILL_FAMILIES),
        definition: z.string().min(3).max(400),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnyClient;
    const c = db(sb);
    const slug = data.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
    const prefix: Record<string, string> = {
      domain: "dom",
      policy: "pol",
      fiscal: "fis",
      stakeholder: "stk",
      communication: "com",
      leadership: "lead",
      digital: "dig",
    };
    const code = `${prefix[data.family]}.${slug}`;
    const { error } = await c.from("portfolio_skills").upsert(
      {
        code,
        family: data.family,
        label: data.label,
        definition: data.definition,
        sort_order: 500,
      },
      { onConflict: "code" },
    );
    if (error)
      throw new Error(
        /row-level security/i.test(error.message)
          ? "Only a global admin can add skills to the taxonomy."
          : error.message,
      );
    const { loadSet } = await import("./engine.server");
    const set = await loadSet(sb, data.setId);
    const rest = (set.proposed_skills ?? []).filter(
      (p) => p.label.trim().toLowerCase() !== data.label.trim().toLowerCase(),
    );
    await c.from("portfolio_persona_sets").update({ proposed_skills: rest }).eq("id", set.id);
    return { code };
  });

/** Maps one of the country's ministries to a primary and secondary portfolios. */
export const mapMinistryPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        ministryId: z.string().uuid(),
        primary: z.string().max(8).nullable(),
        secondary: z.array(z.string().max(8)).max(6),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const { error } = await db(context.supabase as AnyClient).rpc("set_ministry_portfolio", {
      _ministry_id: data.ministryId,
      _primary: data.primary ?? "",
      _secondary: data.secondary,
    });
    if (error) throw governanceError(error);
    return { ok: true };
  });
