// Chamber 07 · Shared AI gateway helper for the real-world research track.
// Server-only. Every field-track derivation (programme plans, instruments,
// comms drafts, synthesis) goes through here so model choice, timeouts,
// retries and JSON repair behave identically everywhere.

const MODEL_PRIMARY = "google/gemini-3.5-flash";
const MODEL_FALLBACK = "google/gemini-3.1-flash-lite";
const TIMEOUT_MS = 90_000;

export async function gatewayJson(
  system: string,
  user: string,
  model: string,
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `${system}\n\nReturn a single valid JSON object only. No prose, no code fences.`,
        },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 240)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("AI returned an empty response.");
  return content;
}

export function parseJsonLoose<T>(s: string): T | null {
  const cleaned = s
    .replace(/```(?:json|JSON)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* fall through to bracket extraction */
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    } catch {
      /* noop */
    }
  }
  return null;
}

/**
 * Ask the gateway for structured JSON, validating the result and falling
 * back to a cheaper model when the primary fails or returns garbage.
 */
export async function deriveJson<T>(opts: {
  system: string;
  user: string;
  validate: (v: unknown) => v is T;
  models?: string[];
}): Promise<T> {
  let lastErr: unknown = null;
  for (const model of opts.models ?? [MODEL_PRIMARY, MODEL_FALLBACK]) {
    try {
      const content = await gatewayJson(opts.system, opts.user, model);
      const candidate = parseJsonLoose<unknown>(content);
      if (opts.validate(candidate)) return candidate;
      lastErr = new Error("AI returned a response that did not match the expected shape.");
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    lastErr instanceof Error ? lastErr.message : "AI could not produce a valid result.",
  );
}
