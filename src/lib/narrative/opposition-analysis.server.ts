// Chamber 05 · Opposition Intel — AI analysis pipeline (server-only helpers).
// 1) Extract text (image OCR / doc / url / raw)
// 2) Motivation pass — Lovable AI grounded in Second Brain themes
// 3) Origin pass — Perplexity with opposition-party hints
// 4) Response-plan generation — structured counter-campaign draft
import type { SupabaseClient } from "@supabase/supabase-js";

import { callSonar, parseSonarJson, fetchCitationText } from "@/lib/country-onboarding/perplexity.server";
import type { Database, Json } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(body: unknown): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 400)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── 1) Extract raw_text from image / doc / url / text ────────────────────

async function extractFromImage(base64: string, mime: string): Promise<string> {
  return callGateway({
    model: "google/gemini-2.5-flash",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "You are an OSINT analyst. Transcribe every visible text verbatim, then describe key visuals (people, symbols, memes, watermarks, hashtags). Note the visual tone (mocking, angry, celebratory, misleading).",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract ALL text and describe the visual composition." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  });
}

async function extractFromDocument(base64: string, mime: string, filename: string): Promise<string> {
  return callGateway({
    model: "google/gemini-2.5-pro",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: "Extract the full readable text of the document. Preserve headings. Plain text only.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Extract text from: ${filename}` },
          { type: "file", file: { filename, file_data: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  });
}

export async function extractRawText(
  supabase: SB,
  row: {
    kind: string;
    storage_path: string | null;
    mime_type: string | null;
    source_url: string | null;
    raw_text: string | null;
  },
): Promise<string> {
  if (row.raw_text && row.raw_text.trim().length > 20) return row.raw_text;

  if (row.storage_path) {
    const { data: file, error } = await supabase.storage
      .from("opposition-intel")
      .download(row.storage_path);
    if (error || !file) throw new Error(error?.message ?? "Download failed");
    const mime = (row.mime_type || "application/octet-stream").toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    if (mime.startsWith("image/")) return extractFromImage(base64, mime);
    if (mime.startsWith("text/")) return buf.toString("utf-8").slice(0, 20_000);
    return extractFromDocument(base64, mime || "application/pdf", row.storage_path.split("/").pop() ?? "file");
  }

  if (row.source_url) {
    const text = await fetchCitationText(row.source_url, 20_000);
    return text ?? row.source_url;
  }

  return row.raw_text ?? "";
}

// ─── 2) Motivation pass ───────────────────────────────────────────────────

export interface MotivationAnalysis {
  motivation_summary: string;
  themes: string[];
  severity: number;
  sentiment: number;
  confidence_grade: "A" | "B" | "C" | "D";
  citations: string[];
}

const MOTIVATION_SCHEMA = {
  type: "object",
  properties: {
    motivation_summary: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    severity: { type: "number" },
    sentiment: { type: "number" },
    confidence_grade: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
  },
  required: ["motivation_summary", "themes", "severity", "sentiment", "confidence_grade"],
};

export async function analyzeMotivation(opts: {
  countryCode: string;
  rawText: string;
  brainContext?: string;
  submitterContext?: string;
}): Promise<MotivationAnalysis> {
  const user = [
    `Country: ${opts.countryCode}`,
    "",
    opts.submitterContext
      ? `Submitter brief (context from the comms team who uploaded this — treat as authoritative on who/what/when depicted):\n${opts.submitterContext.slice(0, 3000)}\n`
      : "",
    "Opposition content:",
    opts.rawText.slice(0, 8000),
    "",
    opts.brainContext ? `Relevant national context (Second Brain):\n${opts.brainContext.slice(0, 4000)}` : "",
    "",
    "Task: Return a strict JSON object per the schema.",
    "- motivation_summary: 2-3 sentences. What message is this opposition content trying to plant, and against whom? Anchor named people/roles to the submitter brief when provided (do not confuse current officeholders with predecessors).",
    "- themes: 3-6 tags (e.g. 'cost-of-living', 'corruption-narrative', 'ethnic-wedge').",
    "- severity 1-5 (5 = imminent political damage), sentiment -2..+2 (-2 = maximally hostile to government).",
    "- confidence_grade A/B/C/D based on source clarity and grounding.",
  ].filter(Boolean).join("\n");


  const res = await callSonar({
    model: "sonar-reasoning-pro",
    system:
      "You are a McKinsey-grade political-comms analyst. You analyse opposition content for underlying motivation, framing techniques, and political intent. Return strict JSON, no prose.",
    user,
    responseSchema: MOTIVATION_SCHEMA,
  });

  const parsed = parseSonarJson<MotivationAnalysis>(res.content) ?? {
    motivation_summary: res.content.slice(0, 800),
    themes: [],
    severity: 2,
    sentiment: -1,
    confidence_grade: "C" as const,
    citations: [],
  };
  parsed.citations = [...(parsed.citations ?? []), ...res.citations.map((c) => c.url)].slice(0, 20);
  parsed.severity = Math.max(1, Math.min(5, Math.round(parsed.severity ?? 2)));
  parsed.sentiment = Math.max(-2, Math.min(2, Math.round(parsed.sentiment ?? -1)));
  return parsed;
}

// ─── 3) Origin pass ───────────────────────────────────────────────────────

export interface OriginAnalysis {
  origin_summary: string;
  amplification: {
    first_seen_platform?: string;
    likely_originator?: string;
    spread_pattern?: string;
    similar_recent_posts?: string[];
    platforms?: string[];
  };
  citations: string[];
}

const ORIGIN_SCHEMA = {
  type: "object",
  properties: {
    origin_summary: { type: "string" },
    amplification: {
      type: "object",
      properties: {
        first_seen_platform: { type: "string" },
        likely_originator: { type: "string" },
        spread_pattern: { type: "string" },
        similar_recent_posts: { type: "array", items: { type: "string" } },
        platforms: { type: "array", items: { type: "string" } },
      },
    },
    citations: { type: "array", items: { type: "string" } },
  },
  required: ["origin_summary", "amplification"],
};

export async function analyzeOrigin(opts: {
  countryCode: string;
  rawText: string;
  motivationSummary: string;
  oppositionPartyNames: string[];
  submitterContext?: string;
}): Promise<OriginAnalysis> {
  const partyHints = opts.oppositionPartyNames.length
    ? `Known opposition parties in-country: ${opts.oppositionPartyNames.join("; ")}.`
    : "";
  const user = [
    `Country: ${opts.countryCode}`,
    partyHints,
    "",
    opts.submitterContext
      ? `Submitter brief (authoritative on who/what/when depicted):\n${opts.submitterContext.slice(0, 2000)}\n`
      : "",
    "Motivation summary of the content:",
    opts.motivationSummary,
    "",
    "Content extract:",
    opts.rawText.slice(0, 4000),
    "",
    "Task: Identify where this narrative originated and how it is spreading.",
    "- origin_summary: 2-3 sentences on likely originator (opposition party, activist network, foreign actor, organic).",
    "- amplification.first_seen_platform: X, TikTok, Facebook, WhatsApp, TV, blog, etc.",
    "- amplification.likely_originator: party/handle/outlet name if identifiable.",
    "- amplification.spread_pattern: coordinated vs organic; velocity.",
    "- amplification.similar_recent_posts: up to 5 URLs showing the same framing in the last 30 days.",
    "- amplification.platforms: list of platforms where this narrative is currently active.",
  ].filter(Boolean).join("\n");


  const res = await callSonar({
    model: "sonar-reasoning-pro",
    system:
      "You are an OSINT tracer. Trace opposition narratives to their likely origin and amplification network. Return strict JSON only.",
    user,
    responseSchema: ORIGIN_SCHEMA,
    recency: "month",
  });

  const parsed =
    parseSonarJson<OriginAnalysis>(res.content) ??
    ({ origin_summary: res.content.slice(0, 800), amplification: {}, citations: [] } as OriginAnalysis);
  parsed.citations = [...(parsed.citations ?? []), ...res.citations.map((c) => c.url)].slice(0, 20);
  return parsed;
}

// ─── 4) Response plan ─────────────────────────────────────────────────────

export interface ResponsePlan {
  posture: "ignore" | "clarify" | "counter" | "escalate";
  objective: string;
  key_messages: Array<{ audience?: string; message: string }>;
  audience_segments: string[];
  channel_plan: Array<{ channel: string; cadence: string; artifact_kind: string }>;
  sequenced_actions: Array<{ when: string; action: string; owner?: string }>;
  risks: string[];
  success_metrics: string[];
  confidence_grade: "A" | "B" | "C" | "D";
  citations: string[];
}

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    posture: { type: "string" },
    objective: { type: "string" },
    key_messages: {
      type: "array",
      items: {
        type: "object",
        properties: { audience: { type: "string" }, message: { type: "string" } },
        required: ["message"],
      },
    },
    audience_segments: { type: "array", items: { type: "string" } },
    channel_plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          channel: { type: "string" },
          cadence: { type: "string" },
          artifact_kind: { type: "string" },
        },
        required: ["channel", "artifact_kind"],
      },
    },
    sequenced_actions: {
      type: "array",
      items: {
        type: "object",
        properties: { when: { type: "string" }, action: { type: "string" }, owner: { type: "string" } },
        required: ["when", "action"],
      },
    },
    risks: { type: "array", items: { type: "string" } },
    success_metrics: { type: "array", items: { type: "string" } },
    confidence_grade: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
  },
  required: ["posture", "objective", "key_messages", "channel_plan", "sequenced_actions"],
};

export async function generatePlan(opts: {
  countryCode: string;
  motivationSummary: string;
  originSummary: string;
  themes: string[];
  severity: number;
  rulingPartyLine?: string;
  manifestoPledges?: string;
  recentToneSamples?: string;
}): Promise<ResponsePlan> {
  const user = [
    `Country: ${opts.countryCode}`,
    "",
    "Opposition motivation:",
    opts.motivationSummary,
    "",
    "Origin & amplification:",
    opts.originSummary,
    "",
    `Themes: ${opts.themes.join(", ") || "n/a"}`,
    `Severity (1-5): ${opts.severity}`,
    "",
    opts.rulingPartyLine ? `Ruling party posture: ${opts.rulingPartyLine}` : "",
    opts.manifestoPledges ? `Manifesto pledges to anchor to:\n${opts.manifestoPledges.slice(0, 2000)}` : "",
    opts.recentToneSamples ? `Recent published tone samples:\n${opts.recentToneSamples.slice(0, 1500)}` : "",
    "",
    "Task: Draft a counter-campaign response plan. Return strict JSON per schema.",
    "- posture: ignore | clarify | counter | escalate. Pick the smallest response that neutralises the threat.",
    "- objective: one crisp sentence.",
    "- key_messages: 3-5 audience-tailored talking points, each grounded in the ruling party's own record and pledges.",
    "- audience_segments: e.g. 'young urban voters', 'diaspora', 'business community'.",
    "- channel_plan: rows of { channel, cadence, artifact_kind }. Prefer channels reaching the amplification platforms.",
    "  artifact_kind values MUST be one of: press_release, social_post, video_script, talking_points, radio_spot, town_hall.",
    "- sequenced_actions: Day 0, Day +1, Day +3, Day +7 rows.",
    "- risks: 2-4 things that could backfire.",
    "- success_metrics: 2-4 KPIs a comms lead would watch.",
    "- confidence_grade A/B/C/D.",
  ].filter(Boolean).join("\n");

  const res = await callSonar({
    model: "sonar-reasoning-pro",
    system:
      "You are a McKinsey-grade sovereign strategic-comms advisor. Draft counter-narrative campaign plans that a Prime Minister's office can execute today. Be specific, action-oriented, and grounded in the country's own record. Return strict JSON only.",
    user,
    responseSchema: PLAN_SCHEMA,
  });

  const parsed =
    parseSonarJson<ResponsePlan>(res.content) ??
    ({
      posture: "clarify",
      objective: res.content.slice(0, 200),
      key_messages: [],
      audience_segments: [],
      channel_plan: [],
      sequenced_actions: [],
      risks: [],
      success_metrics: [],
      confidence_grade: "C",
      citations: [],
    } as ResponsePlan);
  parsed.citations = [...(parsed.citations ?? []), ...res.citations.map((c) => c.url)].slice(0, 20);
  return parsed;
}

// ─── shared helpers to feed grounding context ─────────────────────────────

export async function fetchBrainContext(
  supabase: SB,
  countryCode: string,
  themeQuery: string,
): Promise<string> {
  if (!themeQuery.trim()) return "";
  // Simple text search fallback — full vector search requires embedding call.
  const { data } = await supabase
    .from("country_source_chunks")
    .select("content")
    .eq("country_code", countryCode)
    .textSearch("content", themeQuery.split(/\s+/).slice(0, 6).join(" | "), {
      type: "websearch",
      config: "simple",
    })
    .limit(6);
  return (data ?? []).map((r) => r.content as string).join("\n\n---\n\n");
}

export async function fetchOppositionPartyNames(supabase: SB, countryCode: string): Promise<string[]> {
  const { data } = await supabase
    .from("country_parties")
    .select("name,abbreviation,is_ruling")
    .eq("country_code", countryCode);
  return (data ?? [])
    .filter((p) => !p.is_ruling)
    .map((p) => (p.abbreviation ? `${p.name} (${p.abbreviation})` : (p.name as string)));
}

export async function fetchRulingContext(
  supabase: SB,
  countryCode: string,
): Promise<{ rulingLine: string; pledges: string }> {
  const { data: parties } = await supabase
    .from("country_parties")
    .select("id,name,abbreviation,leader_name")
    .eq("country_code", countryCode)
    .eq("is_ruling", true)
    .limit(1);
  const ruler = parties?.[0];
  const rulingLine = ruler
    ? `${ruler.name}${ruler.abbreviation ? ` (${ruler.abbreviation})` : ""}${ruler.leader_name ? `, led by ${ruler.leader_name}` : ""}.`
    : "";
  let pledges = "";
  if (ruler?.id) {
    const { data: mani } = await supabase
      .from("country_manifestos")
      .select("pledges,themes,summary")
      .eq("country_code", countryCode)
      .eq("party_id", ruler.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const m = mani?.[0];
    if (m) {
      const pl = Array.isArray(m.pledges) ? (m.pledges as unknown[]) : [];
      pledges =
        (m.summary ? `${m.summary}\n\n` : "") +
        pl
          .slice(0, 12)
          .map((p, i) => `${i + 1}. ${typeof p === "string" ? p : JSON.stringify(p)}`)
          .join("\n");
    }
  }
  return { rulingLine, pledges };
}

export function toJson<T>(v: T): Json {
  return v as unknown as Json;
}
