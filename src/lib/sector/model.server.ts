// Server-only: one structured model call for the Sector Studio, with the
// lenient repair and one retry the Digital Government Studio uses.
//
// The model is SECTOR_MODEL on the server (falling back to EGOV_MODEL, then
// the default), so the orchestrating model can be changed without a deploy.

import { generateText, Output } from "ai";
import type { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const DEFAULT_MODEL = "google/gemini-2.5-pro";

export function sectorModelId(): string {
  return process.env.SECTOR_MODEL?.trim() || process.env.EGOV_MODEL?.trim() || DEFAULT_MODEL;
}

export function requireGatewayKey(): string {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey)
    throw new Error(
      "Drafting is unavailable: the AI gateway key (LOVABLE_API_KEY) is not configured on this server.",
    );
  return apiKey;
}

export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  tag: string;
  maxOutputTokens?: number;
}): Promise<{ out: T; model: string }> {
  const { parseFallback, logDraftFailure } = await import("@/lib/ai-json.server");
  const gateway = createLovableAiGatewayProvider(requireGatewayKey(), { structuredOutputs: true });
  const model = sectorModelId();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model: gateway(model),
        system: opts.system,
        output: Output.object({ schema: opts.schema }),
        maxOutputTokens: opts.maxOutputTokens ?? 12000,
        prompt: opts.prompt,
      });
      if (output) return { out: output as T, model };
    } catch (err) {
      lastErr = err;
      const parsed = parseFallback(opts.schema, (err as { text?: string })?.text, opts.tag);
      if (parsed) return { out: parsed, model };
      logDraftFailure(opts.tag, attempt + 1, err);
    }
  }
  const msg = (lastErr as { message?: string })?.message ?? String(lastErr);
  throw new Error(
    `The model could not complete this step after two attempts. Please try again. (${msg.slice(0, 200)})`,
  );
}
