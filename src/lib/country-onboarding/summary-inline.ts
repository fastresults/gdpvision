// Shared bits for having a Sonar/agent response ALSO produce the executive
// summary in the same call, so we don't need a second LLM roundtrip at commit
// time. Only used by single-shot agent stages — multi-call stages (KPI seed,
// ministry deep dive, corpus ingest) still rely on the post-commit fallback in
// summaries.functions.ts.

/**
 * JSON-schema fragment to spread into an agent's responseSchema.properties.
 * Also remember to add "summary_md" (and optionally "summary_highlights") to
 * the schema's `required` array.
 */
export const SUMMARY_SCHEMA_FRAGMENT = {
  summary_md: {
    type: "string",
    description:
      "2 to 4 sentence executive briefing (~90 words max) describing the returned payload in confident, plain English — no filler, no hedging.",
  },
  summary_highlights: {
    type: "array",
    description:
      "3 to 6 short key facts drawn from the returned payload. Each has a concise label and a compact value.",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        label: { type: "string" },
        value: { type: "string" },
      },
      required: ["label", "value"],
    },
  },
} as const;

/**
 * Suffix to append to the agent's system prompt so the model knows to include
 * the summary alongside the structured payload.
 */
export const SUMMARY_SYSTEM_SUFFIX = [
  "",
  "In the SAME response, ALSO include:",
  '- summary_md: a 2 to 4 sentence executive briefing (~90 words max) of the payload, cabinet-grade voice, no filler, no hedging.',
  '- summary_highlights: 3 to 6 { label, value } objects with the most important facts from the payload.',
  "Never invent facts that are not in the payload you are returning.",
].join("\n");

export type InlineSummary = {
  summary_md?: string | null;
  summary_highlights?: Array<{ label: string; value: string }> | null;
};

/**
 * Pull summary_md / summary_highlights off a parsed agent response and clamp
 * them to safe sizes. Returns undefined for missing/empty summaries so the
 * caller can decide to fall back to post-commit generation.
 */
export function extractInlineSummary(parsed: any): InlineSummary {
  if (!parsed || typeof parsed !== "object") return {};
  const raw_md = typeof parsed.summary_md === "string" ? parsed.summary_md.trim() : "";
  const summary_md = raw_md ? raw_md.slice(0, 900) : undefined;
  const raw_h = Array.isArray(parsed.summary_highlights) ? parsed.summary_highlights : [];
  const summary_highlights = raw_h
    .filter((h: any) => h && typeof h.label === "string" && typeof h.value !== "undefined")
    .slice(0, 6)
    .map((h: any) => ({
      label: String(h.label).slice(0, 60),
      value: String(h.value).slice(0, 200),
    }));
  return {
    summary_md,
    summary_highlights: summary_highlights.length ? summary_highlights : undefined,
  };
}
