// Server-only Gemini (Lovable AI Gateway) JSON caller used as Tier-2 fallback.
// Positioned as a REPAIR tier: it receives the Perplexity partial content,
// the country context block, and (optionally) text fetched from the top
// citation URLs, then extracts/repairs the structured payload from that
// grounding material rather than guessing blind.

import { generateText } from "ai";

import { parseSonarJson } from "./perplexity.server";

export type GeminiJsonResult<T> = {
  parsed: T | null;
  content: string;
  model: string;
};

const PRIMARY = "google/gemini-2.5-pro";
const RETRY = "google/gemini-2.5-flash";
const LAST_RESORT = "openai/gpt-5.5";

export async function callGeminiJson<T = any>(opts: {
  system: string;
  user: string;
  schemaHint: string;
  /** Full raw Perplexity content from all Tier-1 attempts (may be empty). */
  partial?: string | null;
  /** Country context block from renderContextBlock(). */
  contextBlock?: string | null;
  /** Concatenated text fetched from top citation URLs. */
  citationText?: string | null;
}): Promise<GeminiJsonResult<T>> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);

  const contextBlock = opts.contextBlock?.trim() ? `\n\n${opts.contextBlock}` : "";
  const partialBlock = opts.partial?.trim()
    ? `\n\nPARTIAL / RAW SEARCH OUTPUT from Perplexity (may be empty, malformed, or incomplete — extract and repair what you can, do not invent facts not present here or in the source material):\n"""\n${opts.partial.slice(0, 8000)}\n"""`
    : "";
  const sourceBlock = opts.citationText?.trim()
    ? `\n\nSOURCE MATERIAL fetched from top citations (use this as the primary factual grounding):\n"""\n${opts.citationText.slice(0, 16000)}\n"""`
    : "";

  const prompt =
    `${opts.user}${contextBlock}${sourceBlock}${partialBlock}\n\nSHAPE (return ONLY a valid JSON object matching this shape, no prose, no code fences):\n${opts.schemaHint}\n\nReturn json.`;

  const models = [PRIMARY, RETRY, LAST_RESORT];
  let lastErr: unknown = null;

  for (const model of models) {
    try {
      const result = await generateText({
        model: gateway(model),
        system:
          opts.system +
          " You are a repair/extraction tier — prefer facts present in SOURCE MATERIAL and PARTIAL / RAW SEARCH OUTPUT above your training data. Never invent numbers, names, or citations. Always return a single valid JSON object. Never include prose or code fences.",
        prompt,
      });
      const text = result.text ?? "";
      const parsed = parseSonarJson<T>(text);
      if (parsed) return { parsed, content: text, model };
      lastErr = new Error(`${model} returned no parseable JSON`);
    } catch (err) {
      lastErr = err;
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 402) throw new Error("Lovable AI credits exhausted — top up in workspace billing.");
    }
  }

  return { parsed: null, content: String((lastErr as Error)?.message ?? ""), model: "none" };
}
