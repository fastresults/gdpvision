// Chamber 05 · low-cost AI call for sorting news stories. Server-only.
// One request per call, no retries and no model fallback chain: a failed
// story is marked failed, and credit/access/rate problems stop the scan.
import { PRESS_CLASSIFIER_MODEL, gatewayOutcome } from "@/lib/press-scan-rules";

export class PressAiStop extends Error {
  constructor(
    message: string,
    public kind: "pause" | "rate",
    public status: number,
  ) {
    super(message);
  }
}

type JsonSchema = Record<string, unknown>;

export async function pressAiJson<T>(opts: {
  system: string;
  user: string;
  name: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new PressAiStop("AI is not configured for this app (missing key).", "pause", 401);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: PRESS_CLASSIFIER_MODEL,
      reasoning_effort: "minimal",
      max_tokens: opts.maxTokens ?? 900,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.name, strict: true, schema: opts.schema },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = body.slice(0, 300);
    try {
      const j = JSON.parse(body) as { message?: string; error?: { message?: string } };
      message = j.message ?? j.error?.message ?? message;
    } catch {
      /* keep raw text */
    }
    const outcome = gatewayOutcome(res.status);
    if (res.status === 402) message = message || "AI credits are used up.";
    if (outcome !== "item")
      throw new PressAiStop(`AI ${res.status}: ${message}`, outcome, res.status);
    throw new Error(`AI ${res.status}: ${message}`);
  }
  const j = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null; refusal?: string | null };
    }>;
  };
  const choice = j.choices?.[0];
  if (choice?.message?.refusal) throw new Error("AI declined to sort this story.");
  const content = choice?.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI returned no usable result.");
    return JSON.parse(m[0]) as T;
  }
}
