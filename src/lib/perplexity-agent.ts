// Shared Perplexity client on the Agent API (`/v1/responses`).
// Perplexity retired `/chat/completions`; every caller sends its old
// chat-completions-shaped payload here and receives a chat-completions-shaped
// JSON back ({ choices, citations, search_results }) so call sites stay small.
// Server-only at runtime: reads PERPLEXITY_API_KEY inside the call.

const ENDPOINT = "https://api.perplexity.ai/v1/responses";

const PRESET_BY_MODEL: Record<string, string> = {
  sonar: "fast-search",
  "sonar-pro": "pro-search",
  "sonar-reasoning": "pro-search",
  "sonar-reasoning-pro": "pro-search",
  "sonar-deep-research": "deep-research",
};

type ChatMessage = { role: string; content: string };
type LegacyPayload = {
  model?: string;
  messages?: ChatMessage[];
  max_tokens?: number;
  response_format?: { type?: string; json_schema?: { name?: string; schema?: unknown } };
  search_domain_filter?: string[];
  search_recency_filter?: string;
  [k: string]: unknown;
};

type AgentOutput = {
  type?: string;
  results?: Array<{ url?: string; title?: string }>;
  content?: Array<{ type?: string; text?: string }>;
};

export function toAgentBody(p: LegacyPayload): Record<string, unknown> {
  const msgs = p.messages ?? [];
  const system = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const user = msgs.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
  const body: Record<string, unknown> = {
    preset: PRESET_BY_MODEL[p.model ?? "sonar"] ?? "pro-search",
    input: user,
  };
  if (system) body.instructions = system;
  if (p.max_tokens) body.max_output_tokens = p.max_tokens;
  const js = p.response_format?.json_schema;
  if (js?.schema) {
    body.text = { format: { type: "json_schema", name: js.name ?? "structured", schema: js.schema } };
  }
  const filters: Record<string, unknown> = {};
  if (p.search_domain_filter?.length) filters.search_domain_filter = p.search_domain_filter;
  if (p.search_recency_filter) filters.search_recency_filter = p.search_recency_filter;
  if (Object.keys(filters).length) body.tools = [{ type: "web_search", filters }];
  return body;
}

export function fromAgentJson(j: { output?: AgentOutput[] }) {
  const out = j.output ?? [];
  const text = out
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
  const seen = new Set<string>();
  const search_results: Array<{ url: string; title?: string }> = [];
  for (const o of out) {
    if (o.type !== "search_results") continue;
    for (const r of o.results ?? []) {
      if (r.url && !seen.has(r.url)) {
        seen.add(r.url);
        search_results.push({ url: r.url, title: r.title });
      }
    }
  }
  return {
    choices: [{ message: { content: text } }],
    citations: search_results.map((r) => r.url),
    search_results,
  };
}

/**
 * Drop-in replacement for `fetch(".../chat/completions", init)`.
 * `init.body` must be the old JSON string payload. Returns a real Response:
 * on success its JSON body is chat-completions-shaped; on failure the
 * provider's status and body pass through unchanged.
 */
export async function perplexityFetch(
  init: { body?: unknown; signal?: AbortSignal | null; [k: string]: unknown },
  timeoutMs?: number,
): Promise<Response> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");
  const legacy = JSON.parse(String(init.body ?? "{}")) as LegacyPayload;
  const signal =
    init.signal ?? (timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined);
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(toAgentBody(legacy)),
    signal,
  });
  if (!r.ok) return new Response(await r.text(), { status: r.status });
  const mapped = fromAgentJson(await r.json());
  return new Response(JSON.stringify(mapped), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
