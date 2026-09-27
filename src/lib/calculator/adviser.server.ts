// @domain marketing
// @ui src/components/brief/AdviserBox.tsx
//
// The Decision Brief's adviser. Answers a visitor's question about the brief
// from two things only: the country's graded public facts and the output of
// the deterministic model. It never produces a number of its own; when the
// honest answer is "move this and see", it returns a what-if, which the page
// recomputes with the same arithmetic and shows before anything is applied.
//
// Model: BRIEF_MODEL env, else the counsel default. Answers are cached per
// (question, configuration) signature for an hour. Server-only.

import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const WHAT_IF_FIELDS = [
  "none",
  "stance",
  "chamber",
  "decisionsPerQuarter",
  "latencyMonths",
  "unmeasuredPct",
  "topSectorSharePct",
  "servicesOfflinePct",
  "unplannedPrioritySharePct",
  "publicSpendPct",
] as const;

export const adviserSchema = z.object({
  answer: z.string(),
  /** Fact keys (gdp, cabinet, latency, …) or "arithmetic" / "assumption". */
  cites: z.array(z.string()),
  what_if_field: z.enum(WHAT_IF_FIELDS),
  /** Chamber index when what_if_field is "chamber" ("01"…"10"), else "". */
  what_if_chamber: z.string(),
  /** New value: adoption 0–100 for a chamber; the input's own unit otherwise. */
  what_if_value: z.number(),
  /** conservative | central | optimistic when what_if_field is "stance", else "". */
  what_if_stance: z.string(),
  what_if_label: z.string(),
});

export type AdviserAnswer = z.infer<typeof adviserSchema>;

export interface AdviserContext {
  country: string;
  region: string;
  facts: Array<{
    key: string;
    label: string;
    display: string;
    grade: string;
    source: string;
    regional: string | null;
  }>;
  inputs: Record<string, number | string>;
  verdict: {
    uplift_usd: number;
    pp_of_gdp: number;
    ceiling_usd: number;
    raw_usd: number;
    return_multiple: number;
    payback_months: number | null;
    annual_cost_usd: number;
    year_one_cost_usd: number;
    term_months: number;
  };
  sequence: Array<{ index: string; title: string; adoption: number; usd: number; why: string }>;
}

const SYSTEM = [
  "You are the adviser on a Decision Brief prepared for a head of government or a permanent secretary.",
  "Voice: restrained, precise, formal British English. No marketing language, no exclamation, no emoji, no bullet points.",
  "Answer only from the FACTS and MODEL blocks you are given. Never invent a figure, a source, a name or a date. If the blocks do not answer the question, say so plainly and say what would.",
  "Never recompute or contradict the arithmetic; quote it. If a question asks 'what if', propose exactly one what-if the page can apply and describe it in what_if_label (under 12 words); the page recomputes it.",
  "Figures graded 'assumption' are not the country's own record: say so whenever your answer leans on one.",
  "cites lists the fact keys you relied on, plus 'arithmetic' for model outputs. Keep 'answer' to at most four sentences.",
  "If no what-if is useful, set what_if_field to 'none', what_if_value to 0 and the other what_if fields to empty strings.",
  "Decline questions unrelated to the brief in one sentence.",
].join(" ");

function contextBlock(c: AdviserContext): string {
  const f = c.facts
    .map(
      (x) =>
        `- ${x.key} | ${x.label}: ${x.display} [grade ${x.grade}; source ${x.source}${x.regional ? `; ${c.region} median ${x.regional}` : ""}]`,
    )
    .join("\n");
  const i = Object.entries(c.inputs)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const s = c.sequence
    .map(
      (x, n) =>
        `${n + 1}. ${x.index} ${x.title} — adoption ${x.adoption}%, year-three US$${Math.round(x.usd).toLocaleString("en-US")}. Why: ${x.why}`,
    )
    .join("\n");
  const v = c.verdict;
  return [
    `COUNTRY: ${c.country} (${c.region})`,
    "FACTS (public, graded):",
    f,
    "MODEL INPUTS:",
    i,
    "MODEL OUTPUT:",
    `- Year-three uplift US$${Math.round(v.uplift_usd).toLocaleString("en-US")} = ${v.pp_of_gdp.toFixed(3)} pp of GDP; ceiling US$${Math.round(v.ceiling_usd).toLocaleString("en-US")}; before the ceiling US$${Math.round(v.raw_usd).toLocaleString("en-US")}.`,
    `- Return ${v.return_multiple.toFixed(1)}x on annual cost US$${Math.round(v.annual_cost_usd).toLocaleString("en-US")} (year one US$${Math.round(v.year_one_cost_usd).toLocaleString("en-US")}); payback ${v.payback_months == null ? "not reached" : `${v.payback_months} months`}; view ${v.term_months} months.`,
    "SEQUENCE:",
    s,
  ].join("\n");
}

const TTL = 60 * 60 * 1000;
const cache = new Map<string, { at: number; a: AdviserAnswer }>();

export function adviserModel(): string {
  return process.env.BRIEF_MODEL?.trim() || "openai/gpt-5.6-sol";
}

export async function askAdviser(
  apiKey: string,
  question: string,
  ctx: AdviserContext,
): Promise<AdviserAnswer> {
  const sig = `${question.toLowerCase().replace(/\s+/g, " ").trim()}::${JSON.stringify(ctx.inputs)}::${ctx.country}`;
  const hit = cache.get(sig);
  if (hit && Date.now() - hit.at < TTL) return hit.a;

  const gateway = createLovableAiGatewayProvider(apiKey, { structuredOutputs: true });
  const model = gateway(adviserModel());
  let out: AdviserAnswer | null = null;
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: adviserSchema }),
      system: SYSTEM,
      prompt: `${contextBlock(ctx)}\n\nQUESTION: ${question}`,
      providerOptions: { lovable: { reasoningEffort: "low" } },
    });
    out = output;
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) throw error;
    out = parseFallback(error.text);
    if (!out) throw new Error("The adviser could not form an answer.");
  }
  const a = { ...out, cites: out.cites.slice(0, 8), answer: out.answer.slice(0, 1200) };
  if (cache.size > 500) cache.clear();
  cache.set(sig, { at: Date.now(), a });
  return a;
}

function parseFallback(text: string | undefined): AdviserAnswer | null {
  if (!text) return null;
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    const p = adviserSchema.safeParse(JSON.parse(text.slice(s, e + 1)));
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ rate limit

const WINDOW = 10 * 60 * 1000;
const LIMIT = 12;
const hits = new Map<string, number[]>();

/** Per-isolate, per-caller: twelve questions in ten minutes. */
export function allowQuestion(caller: string): boolean {
  const now = Date.now();
  const recent = (hits.get(caller) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) {
    hits.set(caller, recent);
    return false;
  }
  recent.push(now);
  hits.set(caller, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
