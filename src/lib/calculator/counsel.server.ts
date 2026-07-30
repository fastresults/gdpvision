// @domain marketing
// @ui src/components/calculator/CounselPanel.tsx
//
// Server-only helper for the value calculator's AI counsel. Lives apart from
// the .functions.ts wrapper because server-fn splitting deletes runtime
// siblings (see tanstack-serverfn-splitting).

import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const counselSchema = z.object({
  verdict: z.string(),
  reading: z.string(),
  highest_leverage: z.string(),
  weakest_assumption: z.string(),
  sequencing: z.array(
    z.object({
      horizon: z.string(),
      chamber: z.string(),
      reason: z.string(),
    }),
  ),
});

export type Counsel = z.infer<typeof counselSchema>;

export interface CounselFacts {
  country: string;
  gdpUsd: number;
  stance: string;
  upliftUsd: number;
  upliftPpOfGdp: number;
  returnMultiple: number;
  paybackMonths: number | null;
  latencyMonths: number;
  unmeasuredPct: number;
  topSectorSharePct: number;
  decisionsPerQuarter: number;
  chambers: Array<{ index: string; short: string; adoption: number; usd: number; mechanism: string }>;
  highestLeverage: string | null;
}

const SYSTEM = [
  "You are the counsel section of a sovereign decision paper prepared for a head of government.",
  "Voice: restrained, precise, British-inflected formal English. No marketing language, no exclamation, no bullet-point salesmanship, no emoji.",
  "You are given the OUTPUT of a deterministic model. Never recompute, contradict, or restate the arithmetic — interpret it.",
  "Be honest about limits: this is a decision-framing model, not a forecast.",
  "Keep 'verdict' to one sentence under 20 words. 'reading' to three sentences. 'highest_leverage' and 'weakest_assumption' to two sentences each.",
  "Return between 2 and 4 sequencing entries, with horizon drawn from: 'First 30 days', 'By six months', 'Within the first year'.",
].join(" ");

function factsBlock(f: CounselFacts): string {
  const adopted = f.chambers
    .filter((c) => c.adoption > 0)
    .map((c) => `${c.index} ${c.short} at ${c.adoption}% adoption, contributing US$${Math.round(c.usd).toLocaleString("en-US")} (${c.mechanism})`)
    .join("; ");
  const untouched = f.chambers.filter((c) => c.adoption === 0).map((c) => `${c.index} ${c.short}`).join(", ");
  return [
    `Country or economy: ${f.country}.`,
    `Nominal GDP: US$${Math.round(f.gdpUsd).toLocaleString("en-US")}.`,
    `Stance: ${f.stance}.`,
    `Modelled year-three uplift: US$${Math.round(f.upliftUsd).toLocaleString("en-US")} (${f.upliftPpOfGdp.toFixed(2)} percentage points of GDP).`,
    `Return against annual instrument cost: ${f.returnMultiple.toFixed(1)}x. Payback: ${f.paybackMonths === null ? "not reached" : `${f.paybackMonths} months`}.`,
    `Stated conditions: ${f.decisionsPerQuarter} GDP-moving decisions per quarter; ${f.latencyMonths} months from question to decision; ${f.unmeasuredPct}% of programme spend unmeasured; ${f.topSectorSharePct}% of output in the largest sector.`,
    `Chambers adopted: ${adopted || "none"}.`,
    `Chambers untouched: ${untouched || "none"}.`,
    `Model names this chamber as the highest-leverage next move: ${f.highestLeverage ?? "none — every chamber is already institutionalised"}.`,
  ].join("\n");
}

export const FALLBACK_COUNSEL: Counsel = {
  verdict: "The configuration is defensible; the counsel narration is temporarily unavailable.",
  reading:
    "The arithmetic below stands on its own and can be inspected in full. Every figure is derived from the conditions you stated and the adoption levels you set. Treat it as a frame for the decision, not as a forecast.",
  highest_leverage:
    "Raise the chamber the model has marked as highest leverage and observe how far the verdict moves. If it moves little, the constraint lies in the conditions rather than the instrument.",
  weakest_assumption:
    "The share of programme spend with no measured outcome is the figure most often understated. Test the verdict against a lower value before relying on it.",
  sequencing: [
    { horizon: "First 30 days", chamber: "01 · The National Ledger", reason: "Nothing else can be trusted until one set of numbers is agreed." },
    { horizon: "By six months", chamber: "06 · The Cabinet Room", reason: "Follow-through on decisions already taken is the cheapest value in government." },
    { horizon: "Within the first year", chamber: "08 · The Mandate Compact", reason: "Scoring the mandate quarterly converts intent into completed work." },
  ],
};

export async function generateCounsel(apiKey: string, facts: CounselFacts): Promise<Counsel> {
  const gateway = createLovableAiGatewayProvider(apiKey, { structuredOutputs: true });
  const model = gateway("openai/gpt-5.6-sol");

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: counselSchema }),
      system: SYSTEM,
      prompt: factsBlock(facts),
      providerOptions: { lovable: { reasoningEffort: "none" } },
    });
    return {
      ...output,
      sequencing: (output.sequencing ?? []).slice(0, 4),
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const parsed = parseFallback(error.text);
      if (parsed) return parsed;
      return FALLBACK_COUNSEL;
    }
    throw error;
  }
}

function parseFallback(text: string | undefined): Counsel | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = counselSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
