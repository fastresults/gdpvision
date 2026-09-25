// @domain standards
// @tables standard_kpi_mappings,standard_requirements,country_kpis,country_kpi_points,collection_protocols,reporting_standards
// @ui src/components/standards/MappingSuggestions.tsx
//
// AI-suggested mappings between a standard's requirements and the figures a
// country already holds. The model may only pick from the country's own
// catalog; every suggestion is checked against it and stored as "suggested".
// Accepting one changes the audit score, so the database lets only an approver
// (can_approve_protocol) accept or reject it (drizzle/migrations/0009 §6).

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { db, governanceError, type MappingRow } from "@/lib/syndication/db";

import { computeCountryAudit } from "./audit-data.server";

const MODEL = "google/gemini-2.5-flash";
const MAX_SUGGESTIONS = 40;
const Code = z.string().min(2).max(3);

// Constraint-free schema: bounds are stated in the prompt and clamped in code
// (bounds inside the schema make otherwise good gateway calls fail post-hoc).
const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      requirement: z.string(),
      kpi_code: z.string(),
      confidence: z.number(),
      rationale: z.string(),
    }),
  ),
});
type RawSuggestions = z.infer<typeof SuggestionSchema>;

function parseFallback(text: string | undefined): RawSuggestions | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = SuggestionSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const suggestMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: Code }).parse(d))
  .handler(
    async ({ data, context }): Promise<{ added: number; skipped: number; considered: number }> => {
      const key = process.env.LOVABLE_API_KEY;
      if (!key)
        throw new Error(
          "AI suggestions are not configured: LOVABLE_API_KEY is missing on the server.",
        );

      const audit = await computeCountryAudit(context.supabase, data.code);
      const gaps = audit.rows.filter((r) => r.status === "missing" || r.status === "partial");
      if (gaps.length === 0) return { added: 0, skipped: 0, considered: 0 };
      if (audit.catalog.length === 0)
        throw new Error(
          "This country has no figures in the platform yet, so there is nothing to map.",
        );

      const catalog = new Map(audit.catalog.map((k) => [k.kpiCode, k]));
      const reqRef = new Map(gaps.map((r, i) => [`R${i + 1}`, r]));
      const curated = new Map(audit.library.requirements.map((r) => [r.id, new Set(r.kpiCodes)]));
      const taken = new Set(audit.mappings.map((m) => `${m.requirement_id}|${m.kpi_code}`));

      const reqLines = Array.from(reqRef.entries())
        .map(
          ([ref, r]) =>
            `${ref} | ${r.standardCode} | ${r.label}${r.clause ? ` (${r.clause})` : ""} | ${r.frequency} | already mapped: ${r.expectedKpis.join(", ") || "none"}`,
        )
        .join("\n");
      const kpiLines = audit.catalog
        .map(
          (k) =>
            `${k.kpiCode} | ${k.label} | ${k.unit} | ${k.category ?? "-"} | latest ${k.latestPeriod ?? "none"}`,
        )
        .join("\n");

      const prompt = `You map international statistical reporting requirements to figures a country already publishes.

Requirements with gaps (ref | standard | requirement | required frequency | figures already mapped):
${reqLines}

The country's figure catalog (kpi_code | label | unit | category | latest period). You may ONLY use kpi_code values from this list:
${kpiLines}

Task: for each requirement, propose figures from the catalog that directly measure what the requirement asks for.
Rules:
- Use only kpi_code values that appear exactly in the catalog above. Never invent a code.
- Use the requirement ref (e.g. "R3") in the "requirement" field.
- Do not propose a figure already listed as mapped for that requirement.
- Only propose a figure that measures the requirement itself, not a loosely related one. Proposing nothing is better than a weak match.
- confidence is a number between 0 and 1: how sure you are that the figure satisfies the requirement.
- rationale is ONE plain-English sentence that names the figure and says why it measures the requirement.
- Return at most ${MAX_SUGGESTIONS} suggestions in total, strongest first.`;

      const gateway = createLovableAiGatewayProvider(key);
      let raw: RawSuggestions | null = null;
      try {
        const { output } = await generateText({
          model: gateway(MODEL),
          output: Output.object({ schema: SuggestionSchema }),
          prompt,
        });
        raw = output;
      } catch (err) {
        raw = parseFallback((err as { text?: string })?.text);
        if (!raw)
          throw new Error(
            `The AI mapping request failed: ${(err as Error)?.message ?? String(err)}`,
          );
      }

      const proposed = raw.suggestions ?? [];
      const seen = new Set<string>();
      const accepted: Array<Omit<MappingRow, "id" | "decided_by" | "decided_at" | "created_at">> =
        [];
      for (const s of proposed) {
        const req = reqRef.get(
          String(s.requirement ?? "")
            .trim()
            .toUpperCase(),
        );
        const kpiCode = String(s.kpi_code ?? "").trim();
        if (!req || !catalog.has(kpiCode)) continue;
        const pair = `${req.id}|${kpiCode}`;
        if (seen.has(pair) || taken.has(pair) || curated.get(req.id)?.has(kpiCode)) continue;
        const rationale = String(s.rationale ?? "").trim();
        if (!rationale) continue;
        seen.add(pair);
        const conf = Number(s.confidence);
        accepted.push({
          country_code: data.code,
          requirement_id: req.id,
          kpi_code: kpiCode,
          status: "suggested",
          confidence: Number.isFinite(conf)
            ? Math.round(Math.min(1, Math.max(0, conf)) * 100) / 100
            : null,
          rationale: rationale.slice(0, 500),
          suggested_by: MODEL,
        });
      }
      accepted.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      const toInsert = accepted.slice(0, MAX_SUGGESTIONS);

      let added = 0;
      if (toInsert.length > 0) {
        const { data: ins, error } = await db(context.supabase)
          .from("standard_kpi_mappings")
          .upsert(toInsert, {
            onConflict: "country_code,requirement_id,kpi_code",
            ignoreDuplicates: true,
          })
          .select("id");
        if (error) throw governanceError(error);
        added = ins?.length ?? 0;
      }
      return { added, skipped: proposed.length - added, considered: gaps.length };
    },
  );

export const decideMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: Code,
        mappingId: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string; status: MappingRow["status"] }> => {
    const { data: row, error } = await db(context.supabase)
      .from("standard_kpi_mappings")
      .update({ status: data.decision })
      .eq("id", data.mappingId)
      .eq("country_code", data.code)
      .select("id,status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("That suggestion was not found, or you don't have access to it.");
    return row as { id: string; status: MappingRow["status"] };
  });

export type MappingView = {
  id: string;
  requirementId: string;
  requirementLabel: string;
  standardCode: string;
  clause: string | null;
  kpiCode: string;
  kpiLabel: string | null;
  unit: string | null;
  latestPeriod: string | null;
  status: MappingRow["status"];
  confidence: number | null;
  rationale: string | null;
  suggestedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export const listMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: Code }).parse(d))
  .handler(async ({ data, context }): Promise<MappingView[]> => {
    const sb = context.supabase;
    const { data: raw, error } = await db(sb)
      .from("standard_kpi_mappings")
      .select("*")
      .eq("country_code", data.code)
      .order("created_at", { ascending: false });
    if (error) throw governanceError(error);
    const rows = (raw ?? []) as MappingRow[];
    if (rows.length === 0) return [];

    const reqIds = Array.from(new Set(rows.map((r) => r.requirement_id)));
    const kpiCodes = Array.from(new Set(rows.map((r) => r.kpi_code)));
    const [rq, kp] = await Promise.all([
      sb.from("standard_requirements").select("id,label,standard_code,clause").in("id", reqIds),
      sb
        .from("country_kpis")
        .select("kpi_code,label,unit,latest_period")
        .eq("country_code", data.code)
        .in("kpi_code", kpiCodes),
    ]);
    if (rq.error) throw governanceError(rq.error);
    if (kp.error) throw governanceError(kp.error);
    const reqs = new Map((rq.data ?? []).map((r) => [r.id, r]));
    const kpis = new Map((kp.data ?? []).map((k) => [k.kpi_code, k]));

    const rank = { suggested: 0, accepted: 1, rejected: 2 } as const;
    return rows
      .map((m) => {
        const r = reqs.get(m.requirement_id);
        const k = kpis.get(m.kpi_code);
        return {
          id: m.id,
          requirementId: m.requirement_id,
          requirementLabel: r?.label ?? "Unknown requirement",
          standardCode: r?.standard_code ?? "",
          clause: r?.clause ?? null,
          kpiCode: m.kpi_code,
          kpiLabel: k?.label ?? null,
          unit: k?.unit ?? null,
          latestPeriod: k?.latest_period ?? null,
          status: m.status,
          confidence: m.confidence == null ? null : Number(m.confidence),
          rationale: m.rationale,
          suggestedBy: m.suggested_by,
          decidedAt: m.decided_at,
          createdAt: m.created_at,
        };
      })
      .sort((a, b) => rank[a.status] - rank[b.status] || (b.confidence ?? 0) - (a.confidence ?? 0));
  });
