// Server-only Gemini (Lovable AI Gateway) JSON caller used as Tier-2 fallback
// when Perplexity returns empty/unparseable. Also supports gpt-5.5 as a last
// gateway retry. Never imported from the client.

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
  // Optional partial content from Tier 1 the model should try to repair/complete.
  partial?: string | null;
  // Free-form schema description injected into the prompt. We deliberately do
  // NOT pass a strict JSON schema here — Gemini does best with a natural-language
  // shape and json_object response format.
  schemaHint: string;
}): Promise<GeminiJsonResult<T>> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);

  const partialBlock = opts.partial?.trim()
    ? `\n\nPARTIAL DRAFT from a previous attempt (may be empty, malformed, or incomplete — repair and complete it):\n${opts.partial.slice(0, 4000)}`
    : "";

  const prompt =
    `${opts.user}\n\nSHAPE (return ONLY a valid JSON object matching this shape, no prose, no code fences):\n${opts.schemaHint}${partialBlock}\n\nReturn json.`;

  const models = [PRIMARY, RETRY, LAST_RESORT];
  let lastErr: unknown = null;

  for (const model of models) {
    try {
      const result = await generateText({
        model: gateway(model),
        system: opts.system + " Always return a single valid JSON object. Never include prose or code fences.",
        prompt,
      });
      const text = result.text ?? "";
      const parsed = parseSonarJson<T>(text);
      if (parsed) return { parsed, content: text, model };
      lastErr = new Error(`${model} returned no parseable JSON`);
    } catch (err) {
      lastErr = err;
      const status = (err as { statusCode?: number }).statusCode;
      // Non-retryable gateway errors: stop cascading
      if (status === 402) throw new Error("Lovable AI credits exhausted — top up in workspace billing.");
      // 429 / 5xx / parse failures: fall through to next model
    }
  }

  return { parsed: null, content: String((lastErr as Error)?.message ?? ""), model: "none" };
}
