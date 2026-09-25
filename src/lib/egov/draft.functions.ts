// @domain egov
// @tables egov_prds,egov_prd_sections,egov_prd_citations,egov_prd_snapshots
// @ui src/components/egov/SectionEditor.tsx
//
// Drafts one PRD section from its context pack. One stage per call: the
// client runs the stages in order, so a Cloudflare request never waits on
// more than one model call. The model sees the pack and nothing else; it
// must cite the pack lines it used, and may declare the section a gap. The
// exact pack, its hash and the citations are stored with the section.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError } from "@/lib/syndication/db";

import type { BrandTokens } from "./brand";
import type { ContextLine, PrdScope, SectionRow, SectionStatus } from "./db";
import { EGOV_STAGE_BY_KEY, EGOV_STAGE_KEYS, type EgovStage } from "./stages";

const DEFAULT_MODEL = "google/gemini-2.5-pro";

/** Set EGOV_MODEL on the server to route drafting to another gateway model. */
function modelId(): string {
  return process.env.EGOV_MODEL?.trim() || DEFAULT_MODEL;
}

const SYSTEM_PROMPT = `You write one section of a product requirements document for a national e-government platform, on behalf of a Caribbean government.

Rules — follow every one:
- Write for a Permanent Secretary, a chief information officer and, later, a procurement committee. Plain, sober English. British/Caribbean spelling: programme, organisation, centre, licence (noun).
- Use ONLY the context lines provided. Never invent a figure, a name, a law, a system, a vendor, a date or a cost. If the context does not support a claim, do not make it.
- Where the section needs information the context lacks, say so in a short "Gaps" list at the end of the section: what is missing and where it should come from. Do not fill a gap with plausible prose.
- Cite context lines by their key (for example kpi.population, ministry.finance) in the citations list. Cite every line whose content you relied on.
- Markdown is allowed: ### sub-headings, short paragraphs, bullet lists, and simple tables. No top-level # or ## headings — the section heading is added for you.
- No promotional language: no "world-class", "cutting-edge", "seamless", "robust", "unlock", "empower".
- Length: 350 to 900 words. Prefer specific, testable statements over general ones.`;

const DraftSchema = z.object({
  body_md: z.string(),
  is_gap: z.boolean(),
  gap_reason: z.string(),
  citations: z.array(z.object({ key: z.string(), why: z.string() })),
});
type Draft = z.infer<typeof DraftSchema>;

async function draft(apiKey: string, prompt: string): Promise<{ out: Draft; model: string }> {
  const { parseFallback, logDraftFailure } = await import("@/lib/ai-json.server");
  // Strict shape mode: the model is told the exact JSON schema up front.
  const gateway = createLovableAiGatewayProvider(apiKey, { structuredOutputs: true });
  const model = modelId();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model: gateway(model),
        system: SYSTEM_PROMPT,
        output: Output.object({ schema: DraftSchema }),
        maxOutputTokens: 12000,
        prompt,
      });
      if (output) return { out: output, model };
    } catch (err) {
      lastErr = err;
      const parsed = parseFallback(DraftSchema, (err as { text?: string })?.text, "egov");
      if (parsed) return { out: parsed, model };
      logDraftFailure("egov", attempt + 1, err);
    }
  }
  const msg = (lastErr as { message?: string })?.message ?? String(lastErr);
  throw new Error(
    `The section could not be drafted after two attempts. Please try again. (${msg.slice(0, 200)})`,
  );
}

function contextBlock(lines: ContextLine[]): string {
  return `CONTEXT (key | text | source). These are the only facts you may use.\n${lines
    .map((l) => `${l.key} | ${l.text} | ${l.source.label}`)
    .join("\n")}`;
}

export interface DraftResult {
  sectionId: string;
  stage: EgovStage;
  status: SectionStatus;
  citations: number;
  contextLines: number;
  gaps: string[];
  model: string;
}

export const draftSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({ code: codeSchema, prdId: z.string().uuid(), stage: z.enum(EGOV_STAGE_KEYS) }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<DraftResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey)
      throw new Error(
        "Drafting is unavailable: the AI gateway key (LOVABLE_API_KEY) is not configured on this server.",
      );

    const c = db(context.supabase);
    const { data: prdRow, error } = await c
      .from("egov_prds")
      .select("id,title,status,scope,brand,country_code")
      .eq("id", data.prdId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!prdRow) throw new Error("That PRD was not found, or you don't have access to it.");
    const prd = prdRow as {
      id: string;
      title: string;
      status: string;
      scope: PrdScope;
      brand: BrandTokens;
    };
    if (prd.status === "approved" || prd.status === "submitted")
      throw new Error(
        "This PRD is under review or approved. Reopen it before redrafting a section.",
      );

    const stage = EGOV_STAGE_BY_KEY[data.stage];
    const { data: sections, error: sErr } = await c
      .from("egov_prd_sections")
      .select("id,stage_key,status,heading,body_md")
      .eq("prd_id", prd.id);
    if (sErr) throw governanceError(sErr);
    const secs = (sections ?? []) as Array<
      Pick<SectionRow, "id" | "stage_key" | "status" | "heading" | "body_md">
    >;
    const target = secs.find((s) => s.stage_key === data.stage);
    if (!target) throw new Error("That section does not exist on this PRD.");
    const missing = stage.after.filter(
      (k) => secs.find((s) => s.stage_key === k)?.status === "pending",
    );
    if (missing.length)
      throw new Error(
        `Draft ${missing.map((k) => EGOV_STAGE_BY_KEY[k].short).join(", ")} first: this section builds on them.`,
      );

    const { buildContextPack } = await import("./context.server");
    const pack = await buildContextPack(
      context.supabase,
      data.code,
      data.stage,
      prd.scope,
      prd.brand,
    );

    // Earlier sections are context too, so later ones stay consistent with them.
    const prior = secs
      .filter((s) => stage.after.includes(s.stage_key) && s.body_md)
      .map((s) => `PRIOR SECTION "${s.heading}":\n${s.body_md.slice(0, 2500)}`)
      .join("\n\n");

    const prompt = `${contextBlock(pack.lines)}

${prior ? `${prior}\n\n` : ""}PRD: "${prd.title}" for ${pack.lines.find((l) => l.key === "country.name")?.text.replace(/^Country: /, "") ?? data.code}.
Section ${stage.ordinal}: ${stage.heading}.

${stage.brief}
${pack.gaps.length ? `\nThe corpus holds no ${pack.gaps.join(" or ")} for this country. Say so in the Gaps list and write what can be written without them.` : ""}
Return body_md (the section text), is_gap (true only if the context supports almost nothing in this section), gap_reason (one sentence, or empty), and citations (the context keys you relied on, each with one short reason).`;

    const { out, model } = await draft(apiKey, prompt);
    const known = new Map(pack.lines.map((l) => [l.key, l]));
    const cited = out.citations.filter((x) => known.has(x.key)).slice(0, 60);
    const body = out.body_md.replace(/^#{1,2}\s.*$/gm, "").trim();
    const status: SectionStatus = out.is_gap || cited.length === 0 ? "gap" : "drafted";
    const bodyOut =
      status === "gap" && out.gap_reason ? `${body}\n\n> **Gap.** ${out.gap_reason.trim()}` : body;

    // Snapshot the previous text so a redraft can be compared.
    if (target.body_md) {
      await c.from("egov_prd_snapshots").insert({
        prd_id: prd.id,
        country_code: data.code,
        reason: `redraft:${data.stage}`,
        sections: [{ stage_key: data.stage, body_md: target.body_md, status: target.status }],
      });
    }

    const { error: uErr } = await c
      .from("egov_prd_sections")
      .update({
        body_md: bodyOut,
        status,
        context_hash: pack.hash,
        context: pack.lines,
        model,
        authored_at: new Date().toISOString(),
        edited_by: null,
        edited_at: null,
      })
      .eq("id", target.id);
    if (uErr) throw governanceError(uErr);

    await c.from("egov_prd_citations").delete().eq("section_id", target.id);
    if (cited.length) {
      const { error: cErr } = await c.from("egov_prd_citations").insert(
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
      gaps: pack.gaps,
      model,
    };
  });
