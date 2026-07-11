// Context Dossier (PRD §12 Screen 10). Given a signal (intake_item), pull the
// researched surround: Ledger facts, related Second-Brain memory objects,
// prior strategy statements, prior comms artifacts, and persisted open
// questions the analyst has not yet resolved.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const Input = z.object({ intakeId: z.string().uuid() });

export interface DossierFact {
  series_id: string;
  metric: string;
  unit: string;
  period: string;
  value: number;
}

export interface DossierQuestion {
  id: string;
  question: string;
  status: "open" | "answered" | "dismissed";
  answer_ref: string | null;
  created_at: string;
}

export interface Dossier {
  signal: {
    id: string;
    scope_key: string;
    sector_code: string;
    topic: string;
    summary: string | null;
    url: string | null;
    proposed_weight: number;
    final_weight: number | null;
    state: string;
    created_at: string;
  };
  memory: Array<{ id: string; kind: string; title: string; weight: number | null; created_at: string }>;
  strategies: Array<{ id: string; title: string; status: string; created_at: string }>;
  comms: Array<{ id: string; kind: string; audience: string; state: string; created_at: string }>;
  facts: DossierFact[];
  questions: DossierQuestion[];
}

export const getDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<Dossier> => {
    const { supabase } = context;
    const { data: signal, error: sErr } = await supabase
      .from("intake_items")
      .select("id,scope_key,sector_code,topic,summary,url,proposed_weight,final_weight,state,created_at")
      .eq("id", data.intakeId)
      .single();
    if (sErr) throw new Error(sErr.message);

    // Pull recent Ledger facts scoped to this signal's country+sector.
    const { data: series } = await supabase
      .from("series")
      .select("id,metric,unit,sector_code")
      .eq("country_code", signal.scope_key)
      .eq("sector_code", signal.sector_code)
      .limit(40);
    const seriesById = new Map((series ?? []).map((s) => [s.id, s]));
    const { data: points } = seriesById.size
      ? await supabase
          .from("series_points")
          .select("series_id,period,value")
          .in("series_id", Array.from(seriesById.keys()))
          .order("period", { ascending: false })
          .limit(80)
      : { data: [] };

    const facts: DossierFact[] = [];
    const seenSeries = new Set<string>();
    for (const p of points ?? []) {
      if (seenSeries.has(p.series_id)) continue;
      const s = seriesById.get(p.series_id);
      if (!s) continue;
      seenSeries.add(p.series_id);
      facts.push({ series_id: p.series_id, metric: s.metric, unit: s.unit, period: p.period, value: Number(p.value) });
      if (facts.length >= 8) break;
    }

    // Apply source suppressions to memory retrieval.
    const { data: suppressions } = await supabase
      .from("source_suppressions")
      .select("source_id")
      .eq("scope_key", signal.scope_key)
      .eq("active", true);
    const suppressedIds = new Set((suppressions ?? []).map((s) => s.source_id));

    const [{ data: memoryRaw }, { data: strategies }, { data: comms }, { data: questions }] = await Promise.all([
      supabase
        .from("memory_objects")
        .select("id,kind,title,weight,created_at,source_id")
        .eq("scope_key", signal.scope_key)
        .eq("sector_code", signal.sector_code)
        .order("weight", { ascending: false, nullsFirst: false })
        .limit(30),
      supabase
        .from("strategy_statements")
        .select("id,title,status,created_at")
        .eq("scope_key", signal.scope_key)
        .eq("sector_code", signal.sector_code)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("comms_artifacts")
        .select("id,kind,audience,draft_state,created_at")
        .eq("scope_key", signal.scope_key)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("dossier_questions")
        .select("id,question,status,answer_ref,created_at")
        .eq("signal_id", signal.id)
        .order("created_at", { ascending: true }),
    ]);

    const memory = (memoryRaw ?? [])
      .filter((m) => !m.source_id || !suppressedIds.has(m.source_id))
      .slice(0, 20);

    return {
      signal,
      memory: memory.map((m) => ({
        id: m.id,
        kind: m.kind as string,
        title: m.title,
        weight: m.weight,
        created_at: m.created_at,
      })),
      strategies: (strategies ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status as string,
        created_at: s.created_at,
      })),
      comms: (comms ?? []).map((c) => ({
        id: c.id,
        kind: c.kind as string,
        audience: c.audience,
        state: c.draft_state as string,
        created_at: c.created_at,
      })),
      facts,
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        status: q.status as DossierQuestion["status"],
        answer_ref: q.answer_ref,
        created_at: q.created_at,
      })),
    };
  });

// ─── Open Questions: AI-generated, persisted per signal ────────────────────

const GenerateInput = z.object({ intakeId: z.string().uuid() });

const QuestionsSchema = z.object({
  questions: z.array(z.string().min(6).max(240)).min(3).max(6),
});

export const generateDossierQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: signal, error } = await context.supabase
      .from("intake_items")
      .select("id,scope_key,sector_code,topic,summary")
      .eq("id", data.intakeId)
      .single();
    if (error) throw new Error(error.message);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const result = await generateText({
      model: gateway("openai/gpt-5.5"),
      prompt: [
        `Signal in scope ${signal.scope_key}, sector ${signal.sector_code}.`,
        `Topic: ${signal.topic}.`,
        signal.summary ? `Summary: ${signal.summary}` : "",
        "Generate the 3-6 sharpest open questions a sovereign policy analyst must answer before drafting a strategy statement. Each question must be answerable, concrete, and specific to this country and sector — no generic macro chatter.",
      ]
        .filter(Boolean)
        .join(" "),
      experimental_output: Output.object({ schema: QuestionsSchema }) as any,
    } as any);

    const out = (result as any).experimental_output ?? (result as any).output;
    const questions: string[] = out?.questions ?? [];
    if (questions.length === 0) throw new Error("No questions returned");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = questions.map((q) => ({
      signal_id: signal.id,
      scope_key: signal.scope_key,
      sector_code: signal.sector_code,
      question: q,
      created_by: context.userId,
    }));
    const { error: insErr } = await supabaseAdmin.from("dossier_questions").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { inserted: rows.length };
  });

const UpdateQuestionInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "answered", "dismissed"]),
  answerRef: z.string().max(500).optional(),
});

export const updateDossierQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateQuestionInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("dossier_questions")
      .update({ status: data.status, answer_ref: data.answerRef ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
