// @domain scenarios
// @tables countries,country_kpis,country_sectors,intake_items,ministries
// @ui src/components/scenarios/AiRecommendDrawer.tsx; src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx

// AI Scenario Recommender — reads the country's second-brain context and
// returns a fully-configured scenario (title, horizon, playbooks, exact lever
// values, thesis, risks, citations) grounded in the current lever defs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LeverDefInput = z.object({
  slug: z.string(),
  sector_code: z.string(),
  response_fn_ref: z.string(),
  bounds: z.object({
    min: z.number(),
    max: z.number(),
    default: z.number().optional(),
  }),
});

const RecommendInput = z.object({
  countryCode: z.string().min(3).max(4),
  ministrySlug: z.string().min(1).max(64).nullable().optional(),
  challenge: z.string().min(3).max(1200),
  horizonYearsHint: z.number().int().min(1).max(10).optional(),
  leverDefs: z.array(LeverDefInput).min(1).max(300),
});

export interface RecommendedScenario {
  title: string;
  thesis: string;
  horizonYears: number;
  playbook: {
    id: string;
    label: string;
    blurb: string;
    thesis: string;
    lever_moves: Array<{ slug: string; direction: "up" | "down"; magnitude: number }>;
  };
  levers: Record<string, number>;
  moves: Array<{
    slug: string;
    label: string;
    from: number;
    to: number;
    rationale: string;
  }>;
  risks: string[];
  assumptions: string[];
  citations: Array<{ label: string; kind: string; ref?: string }>;
}

export const recommendScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RecommendInput.parse(data))
  .handler(async ({ data, context }): Promise<{ scenario: RecommendedScenario | null; note?: string }> => {
    const { supabase } = context;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Lovable AI Gateway not configured");

    // ── Context assembly ──────────────────────────────────────────────────
    const [
      { data: country },
      { data: sectors },
      { data: kpis },
      { data: ministry },
      { data: signals },
    ] = await Promise.all([
      supabase.from("countries").select("name").eq("code", data.countryCode).maybeSingle(),
      supabase
        .from("country_sectors")
        .select("sector_code,share_pct,confidence_grade")
        .eq("country_code", data.countryCode)
        .order("share_pct", { ascending: false })
        .limit(12),
      supabase
        .from("country_kpis")
        .select("kpi_code,label,latest_value,unit,target,direction")
        .eq("country_code", data.countryCode)
        .limit(20),
      data.ministrySlug
        ? supabase
            .from("ministries")
            .select("name,slug,ministry_sectors(sector_code,weight)")
            .eq("country_code", data.countryCode)
            .eq("slug", data.ministrySlug)
            .maybeSingle()
        : Promise.resolve({
            data: null as null | {
              name: string;
              slug: string;
              ministry_sectors: Array<{ sector_code: string; weight: number }>;
            },
          }),
      supabase
        .from("intake_items")
        .select("topic,summary,severity,final_weight")
        .eq("scope_key", data.countryCode)
        .order("final_weight", { ascending: false, nullsFirst: false })
        .limit(8),
    ]);

    const countryName = country?.name ?? data.countryCode;
    const leverList = data.leverDefs
      .slice(0, 80)
      .map(
        (d) =>
          `- ${d.slug} (sector:${d.sector_code} bounds:${d.bounds.min}..${d.bounds.max} default:${d.bounds.default ?? d.bounds.min})`,
      )
      .join("\n");
    const sectorList =
      (sectors ?? [])
        .map(
          (s) =>
            `- ${s.sector_code}: ${Number(s.share_pct).toFixed(1)}% GDP (grade ${s.confidence_grade})`,
        )
        .join("\n") || "- (no sector composition)";
    const kpiList =
      (kpis ?? [])
        .map(
          (k) =>
            `- ${k.kpi_code} ${k.label}: ${k.latest_value ?? "—"}${k.unit ? ` ${k.unit}` : ""} (target ${k.target ?? "—"}, dir ${k.direction ?? "—"})`,
        )
        .join("\n") || "- (no KPIs)";
    const ministryLine = ministry
      ? `Ministry focus: ${ministry.name} — sectors: ${(ministry.ministry_sectors ?? []).map((m) => m.sector_code).join(", ") || "n/a"}`
      : "Ministry focus: cross-portfolio";
    const signalList =
      (signals ?? [])
        .map(
          (s) =>
            `- [w${(s.final_weight ?? 0).toFixed?.(1) ?? "?"}] ${s.topic}${s.summary ? ` — ${String(s.summary).slice(0, 160)}` : ""}`,
        )
        .join("\n") || "- (no recent signals)";
    const threatList = "- (no tracked existential threats)";

    const horizonHint = data.horizonYearsHint ?? 5;

    const prompt = [
      `You are a McKinsey senior partner briefing the ${countryName} Cabinet.`,
      `The user describes a policy challenge. Design ONE cohesive scenario that responds to it — grounded in the country's real sector mix, KPIs, ministry mandate, live signals, and known existential threats.`,
      "",
      `USER CHALLENGE:`,
      `"""${data.challenge}"""`,
      "",
      ministryLine,
      `Suggested horizon: ${horizonHint} years (adjust 1-10 if the challenge implies otherwise).`,
      "",
      "Sector composition (current):",
      sectorList,
      "",
      "Key KPIs:",
      kpiList,
      "",
      "Recent high-priority signals:",
      signalList,
      "",
      "Tracked existential threats:",
      threatList,
      "",
      "Available policy levers (slug + bounds — you MUST only reference these slugs):",
      leverList,
      "",
      "Return STRICT JSON (no prose, no markdown fence) matching:",
      `{
  "title": "headline-style, <= 60 chars",
  "thesis": "2-4 sentences: what this scenario proves, in plain language",
  "horizonYears": 5,
  "playLabel": "Title Case play name, <= 5 words",
  "playBlurb": "one sentence, <= 120 chars",
  "playThesis": "2-3 sentences justifying the composition",
  "lever_moves": [
    {"slug":"<one of the lever slugs above>","direction":"up|down","magnitude":0.0..1.0,"rationale":"<= 140 chars, grounded"}
  ],
  "risks": ["short risk 1", "short risk 2", "..."],
  "assumptions": ["what must be true 1", "..."],
  "citations": [{"label":"human label","kind":"kpi|sector|signal|ministry|threat","ref":"code or id"}]
}`,
      "",
      "Rules:",
      "- Move 4-10 levers. Pick the ones that materially change GDP for this challenge.",
      "- Only use lever slugs from the list. Drop anything else.",
      "- magnitude 1.0 = push to a bound; 0.5 = midway.",
      "- Cite at least 3 grounding items (KPIs, sectors, signals, threats).",
      "- Be specific to the challenge — not a generic policy brief.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          {
            role: "system",
            content:
              "You design cohesive sovereign policy scenarios grounded in real country data. Respond with strict JSON only.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI Gateway rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI Gateway ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { scenario: null, note: "AI response could not be parsed. Try Regenerate." };
    }

    // ── Validate + build lever map ────────────────────────────────────────
    const defsBySlug = new Map(data.leverDefs.map((d) => [d.slug, d]));
    const rawMoves = Array.isArray(parsed.lever_moves) ? parsed.lever_moves : [];
    const moves: RecommendedScenario["moves"] = [];
    const leversOut: Record<string, number> = {};
    for (const d of data.leverDefs) {
      leversOut[d.slug] = d.bounds.default ?? d.bounds.min;
    }
    const leverMovesForPlaybook: RecommendedScenario["playbook"]["lever_moves"] = [];

    for (const mv of rawMoves) {
      if (!mv || typeof mv !== "object") continue;
      const m = mv as Record<string, unknown>;
      const slug = String(m.slug ?? "");
      const def = defsBySlug.get(slug);
      if (!def) continue;
      const direction = m.direction === "down" ? "down" : "up";
      const magnitude = Math.max(0, Math.min(1, Number(m.magnitude ?? 0.5)));
      const base = def.bounds.default ?? (def.bounds.min + def.bounds.max) / 2;
      const range = def.bounds.max - def.bounds.min;
      const target = base + (direction === "up" ? 1 : -1) * magnitude * range * 0.5;
      const clamped = Math.max(def.bounds.min, Math.min(def.bounds.max, target));
      const from = base;
      leversOut[slug] = clamped;
      moves.push({
        slug,
        label: slug,
        from,
        to: clamped,
        rationale: String(m.rationale ?? "").slice(0, 200),
      });
      leverMovesForPlaybook.push({ slug, direction, magnitude });
    }

    if (moves.length === 0) {
      return {
        scenario: null,
        note: "AI returned no usable lever moves. Try rephrasing the challenge or Regenerate.",
      };
    }

    const rawCites = Array.isArray(parsed.citations) ? parsed.citations : [];
    const citations = rawCites
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .slice(0, 8)
      .map((c) => ({
        label: String(c.label ?? "").slice(0, 100),
        kind: String(c.kind ?? "misc").slice(0, 20),
        ref: c.ref !== undefined ? String(c.ref).slice(0, 80) : undefined,
      }));

    const rawRisks = Array.isArray(parsed.risks) ? parsed.risks : [];
    const rawAssumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];

    const horizonYears = Math.max(
      1,
      Math.min(10, Math.round(Number(parsed.horizonYears ?? horizonHint))),
    );

    const playLabel = String(parsed.playLabel ?? "AI recommendation").slice(0, 60);
    const playId = `ai-rec-${Date.now().toString(36)}-${playLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)}`;

    const scenario: RecommendedScenario = {
      title: String(parsed.title ?? "").slice(0, 80) || playLabel,
      thesis: String(parsed.thesis ?? "").slice(0, 1200),
      horizonYears,
      playbook: {
        id: playId,
        label: playLabel,
        blurb: String(parsed.playBlurb ?? "").slice(0, 160),
        thesis: String(parsed.playThesis ?? parsed.thesis ?? "").slice(0, 800),
        lever_moves: leverMovesForPlaybook,
      },
      levers: leversOut,
      moves,
      risks: rawRisks.slice(0, 8).map((r) => String(r).slice(0, 200)),
      assumptions: rawAssumptions.slice(0, 8).map((a) => String(a).slice(0, 200)),
      citations,
    };

    return { scenario };
  });
