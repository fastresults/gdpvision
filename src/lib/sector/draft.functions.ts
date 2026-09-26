// @domain sector
// @tables sector_plans,sector_plan_sections,sector_plan_citations,sector_plan_snapshots
// @ui src/routes/_authenticated/admin/countries.$code.sector_.$planId.tsx
//
// Drafts one Sector Development Plan section from its context pack. One
// stage per call, in dependency order, as in chamber 09. The orchestrator
// plays the stage's agent (Diagnostician, Strategist, Planner, Economist,
// Measurer, Drafter); the Auditor's deterministic checks run on the result.
// The exact pack, its hash, the citations and the audit are stored with the
// section.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError } from "@/lib/syndication/db";

import { auditSection } from "./audit";
import { scopeOf, type ContextLine, type PlanSectionRow, type SectionStatus } from "./db";
import {
  SECTOR_STAGE_BY_KEY,
  SECTOR_STAGE_KEYS,
  type SectorAgent,
  type SectorStage,
} from "./stages";

const AGENT_ROLE: Record<SectorAgent, string> = {
  diagnostician:
    "You are the Diagnostician. You establish where the sector stands and name its binding constraint from evidence, with a stated confidence.",
  strategist:
    "You are the Strategist. You make a narrow, defensible choice: what the sector will become, what it will not do, and when to stop.",
  planner:
    "You are the Planner. You turn strategy into a small number of concrete projects, each with an owner, a funder, dates and a KPI.",
  economist:
    "You are the Economist. You price what can be priced as ranges tied to named assumptions, and attach conditions and sunsets to every incentive.",
  measurer:
    "You are the Measurer. Every KPI you write has a baseline, a source and an owner, or goes on a data-collection list.",
  drafter:
    "You are the Drafter. You write the instruments of the plan — the Compact, the Council charter, the public narrative — in the plain voice of the government.",
};

const SYSTEM_PROMPT = `You write one section of a Sector Development Plan for a Caribbean government, as part of GDPVision's Sector Studio.

Rules — follow every one:
- Write for a Head of Government, a line minister and a Permanent Secretary. Plain, sober English. British/Caribbean spelling: programme, organisation, centre, licence (noun).
- Use ONLY the context lines provided, and the method lines (keys beginning "method.") for how to structure the section. Never invent a figure, a name, a law, a firm, a date or a cost. If the context does not support a claim, do not make it.
- The method lines describe other countries' experience. Use them to shape the approach; never present another country's figures as this country's.
- Where the section needs information the context lacks, write "To be confirmed" (or "baseline to be established") in place and list it in a short "Gaps" list at the end: what is missing and where it should come from.
- Cite context lines by their key (for example kpi.gdp_growth, brief.executive, ministry.tourism) in the citations list. Cite every corpus line you relied on. Do not cite scope.* lines.
- Markdown is allowed: ### sub-headings, short paragraphs, bullet lists, and pipe tables. No top-level # or ## headings — the section heading is added for you.
- No promotional language: no "world-class", "cutting-edge", "seamless", "robust", "unlock", "empower", "game-changer".
- Length: 400 to 1,000 words. Prefer specific, testable statements over general ones.`;

const DraftSchema = z.object({
  body_md: z.string(),
  is_gap: z.boolean(),
  gap_reason: z.string(),
  citations: z.array(z.object({ key: z.string(), why: z.string() })),
});

function contextBlock(lines: ContextLine[]): string {
  return `CONTEXT (key | text | source). These are the only facts you may use.\n${lines
    .map((l) => `${l.key} | ${l.text} | ${l.source.label}`)
    .join("\n")}`;
}

export interface SectorDraftResult {
  sectionId: string;
  stage: SectorStage;
  status: SectionStatus;
  citations: number;
  contextLines: number;
  findings: number;
  gaps: string[];
  model: string;
}

export const draftPlanSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({ code: codeSchema, planId: z.string().uuid(), stage: z.enum(SECTOR_STAGE_KEYS) }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<SectorDraftResult> => {
    const { generateStructured, requireGatewayKey } = await import("./model.server");
    requireGatewayKey();

    const c = db(context.supabase);
    const { data: planRow, error } = await c
      .from("sector_plans")
      .select("id,title,status,scope,sector_code,country_code")
      .eq("id", data.planId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!planRow) throw new Error("That plan was not found, or you don't have access to it.");
    const plan = planRow as {
      id: string;
      title: string;
      status: string;
      scope: unknown;
      sector_code: string;
    };
    if (plan.status === "approved" || plan.status === "submitted")
      throw new Error(
        "This plan is under review or approved. Reopen it before redrafting a section.",
      );
    const scope = scopeOf(plan.scope);

    const stage = SECTOR_STAGE_BY_KEY[data.stage];
    const { data: sections, error: sErr } = await c
      .from("sector_plan_sections")
      .select("id,stage_key,status,heading,body_md")
      .eq("plan_id", plan.id);
    if (sErr) throw governanceError(sErr);
    const secs = (sections ?? []) as Array<
      Pick<PlanSectionRow, "id" | "stage_key" | "status" | "heading" | "body_md">
    >;
    const target = secs.find((s) => s.stage_key === data.stage);
    if (!target) throw new Error("That section does not exist on this plan.");
    const missing = stage.after.filter(
      (k) => secs.find((s) => s.stage_key === k)?.status === "pending",
    );
    if (missing.length)
      throw new Error(
        `Draft ${missing.map((k) => SECTOR_STAGE_BY_KEY[k].short).join(", ")} first: this section builds on them.`,
      );

    const { buildSectorPack } = await import("./context.server");
    const pack = await buildSectorPack(
      context.supabase,
      data.code,
      plan.sector_code,
      data.stage,
      scope,
    );

    const prior = secs
      .filter((s) => stage.after.includes(s.stage_key) && s.body_md)
      .map((s) => `PRIOR SECTION "${s.heading}":\n${s.body_md.slice(0, 3000)}`)
      .join("\n\n");
    const countryName =
      pack.lines.find((l) => l.key === "country.name")?.text.replace(/^Country: /, "") ?? data.code;
    const sectorName =
      pack.lines.find((l) => l.key === "sector.name")?.text.replace(/^Sector: /, "") ??
      plan.sector_code;

    const prompt = `${contextBlock(pack.lines)}

${prior ? `${prior}\n\n` : ""}PLAN: "${plan.title}" — ${sectorName}, ${countryName}.
Section ${stage.ordinal}: ${stage.heading}.

${stage.brief}
${pack.gaps.length ? `\nThe corpus holds no ${pack.gaps.join(" or ")} for this sector. Say so in the Gaps list and write what can be written without them.` : ""}
Return body_md (the section text), is_gap (true only if the context supports almost nothing in this section), gap_reason (one sentence, or empty), and citations (the context keys you relied on, each with one short reason).`;

    const { out, model } = await generateStructured({
      schema: DraftSchema,
      system: `${SYSTEM_PROMPT}\n\n${AGENT_ROLE[stage.agent]}`,
      prompt,
      tag: "sector",
    });

    const known = new Map(pack.lines.map((l) => [l.key, l]));
    const cited = out.citations
      .filter((x) => known.has(x.key) && known.get(x.key)!.source.kind !== "user")
      .slice(0, 60);
    const body = out.body_md.replace(/^#{1,2}\s.*$/gm, "").trim();
    const status: SectionStatus = out.is_gap || cited.length === 0 ? "gap" : "drafted";
    const bodyOut =
      status === "gap" && out.gap_reason ? `${body}\n\n> **Gap.** ${out.gap_reason.trim()}` : body;

    const others = Object.fromEntries(secs.map((s) => [s.stage_key, s.body_md])) as Partial<
      Record<SectorStage, string>
    >;
    const audit = auditSection(data.stage, bodyOut, cited.length, others);

    if (target.body_md) {
      await c.from("sector_plan_snapshots").insert({
        plan_id: plan.id,
        country_code: data.code,
        reason: `redraft:${data.stage}`,
        sections: [{ stage_key: data.stage, body_md: target.body_md, status: target.status }],
      });
    }

    const { error: uErr } = await c
      .from("sector_plan_sections")
      .update({
        body_md: bodyOut,
        status,
        context_hash: pack.hash,
        context: pack.lines,
        audit,
        model,
        authored_at: new Date().toISOString(),
        edited_by: null,
        edited_at: null,
      })
      .eq("id", target.id);
    if (uErr) throw governanceError(uErr);

    await c.from("sector_plan_citations").delete().eq("section_id", target.id);
    if (cited.length) {
      const { error: cErr } = await c.from("sector_plan_citations").insert(
        cited.map((x) => {
          const l = known.get(x.key)!;
          return {
            section_id: target.id,
            country_code: data.code,
            source_kind: l.source.kind,
            source_ref: l.source.ref,
            label: l.source.label,
            excerpt: `${l.text.slice(0, 240)}${x.why ? ` — ${x.why.slice(0, 160)}` : ""}`,
            confidence: null,
          };
        }),
      );
      if (cErr) throw governanceError(cErr);
    }

    return {
      sectionId: target.id,
      stage: data.stage,
      status,
      citations: cited.length,
      contextLines: pack.lines.length,
      findings: audit.length,
      gaps: pack.gaps,
      model,
    };
  });
