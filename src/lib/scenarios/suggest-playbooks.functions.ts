// @domain scenarios
// @tables countries,country_kpis,country_sectors,intake_items,ministries
// @ui src/components/scenarios/AiPlaySuggestions.tsx

// AI-suggested playbooks. Grounds Gemini in the country's second-brain
// (KPIs, sector shares, active threats, ministry mandate, recent P1/P2 signals)
// and returns candidate plays as {direction, magnitude} moves over the current
// lever defs.

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

const SuggestInput = z.object({
  countryCode: z.string().min(3).max(4),
  ministrySlug: z.string().min(1).max(64).nullable().optional(),
  sectorCode: z.string().min(2).max(64).nullable().optional(),
  focus: z.string().max(500).optional(),
  leverDefs: z.array(LeverDefInput).min(1).max(200),
  count: z.number().int().min(1).max(5).default(3),
});

export interface SuggestedPlay {
  id: string;
  label: string;
  blurb: string;
  thesis: string;
  citations: Array<{ label: string; kind: string; ref?: string }>;
  lever_moves: Array<{ slug: string; direction: "up" | "down"; magnitude: number }>;
}

export const suggestPlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SuggestInput.parse(data))
  .handler(async ({ data, context }): Promise<{ plays: SuggestedPlay[]; note?: string }> => {
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
        .limit(15),
      data.ministrySlug
        ? supabase
            .from("ministries")
            .select("name,slug,ministry_sectors(sector_code,weight)")
            .eq("country_code", data.countryCode)
            .eq("slug", data.ministrySlug)
            .maybeSingle()
        : Promise.resolve({ data: null as null | { name: string; slug: string; ministry_sectors: Array<{ sector_code: string; weight: number }> } }),
      supabase
        .from("intake_items")
        .select("topic,summary,severity,final_weight")
        .eq("scope_key", data.countryCode)
        .order("final_weight", { ascending: false, nullsFirst: false })
        .limit(8),
    ]);

    const countryName = country?.name ?? data.countryCode;
    const leverList = data.leverDefs
      .slice(0, 60)
      .map(
        (d) =>
          `- ${d.slug} (sector: ${d.sector_code}, bounds: ${d.bounds.min}..${d.bounds.max}, default: ${d.bounds.default ?? d.bounds.min})`,
      )
      .join("\n");
    const sectorList = (sectors ?? [])
      .map(
        (s) => `- ${s.sector_code}: ${Number(s.share_pct).toFixed(1)}% GDP (grade ${s.confidence_grade})`,
      )
      .join("\n") || "- (no sector composition available)";
    const kpiList = (kpis ?? [])
      .map(
        (k) =>
          `- ${k.kpi_code} ${k.label}: ${k.latest_value ?? "—"}${k.unit ? ` ${k.unit}` : ""} (target ${k.target ?? "—"}, dir ${k.direction ?? "—"})`,
      )
      .join("\n") || "- (no KPIs)";
    const ministryLine = ministry
      ? `Ministry focus: ${ministry.name} — sectors: ${(ministry.ministry_sectors ?? []).map((m) => m.sector_code).join(", ") || "n/a"}`
      : "Ministry focus: cross-portfolio";
    const signalList = (signals ?? [])
      .map((s) => `- [w${(s.final_weight ?? 0).toFixed?.(1) ?? s.final_weight ?? "?"}] ${s.topic}${s.summary ? ` — ${String(s.summary).slice(0, 160)}` : ""}`)
      .join("\n") || "- (no recent signals)";

    const focusLine = data.focus?.trim()
      ? `Additional user focus: "${data.focus.trim()}"`
      : "";

    const prompt = [
      `You are a McKinsey partner advising the ${countryName} Cabinet.`,
      `Propose ${data.count} DISTINCT, non-obvious "policy plays" the government could rehearse in the Scenario Engine.`,
      `Each play must map to concrete moves across the country's current policy levers (listed below).`,
      "",
      ministryLine,
      focusLine,
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
      "Available policy levers (slug + bounds):",
      leverList,
      "",
      "Return STRICT JSON matching this shape (no prose, no markdown fence):",
      `{
  "plays": [
    {
      "id": "kebab-case-slug",
      "label": "Title Case, <= 5 words",
      "blurb": "one sentence, <= 120 chars, plain language",
      "thesis": "2-3 sentences: why this play, grounded in the KPIs/signals above",
      "citations": [{"label":"human label","kind":"kpi|sector|signal|ministry","ref":"code or id"}],
      "lever_moves": [
        {"slug":"<one of the lever slugs above>","direction":"up|down","magnitude":0.0..1.0}
      ]
    }
  ]
}`,
      "",
      "Rules:",
      "- Only use lever slugs from the list above. Drop anything else.",
      "- Each play should move 2-6 levers.",
      "- Plays should be genuinely different from each other (different sectors / postures).",
      "- Avoid duplicating obvious presets (baseline hold, generic fiscal consolidation).",
      "- magnitude 1.0 = push the lever to a bound; 0.5 = midway.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You produce grounded, non-generic policy plays for sovereign scenario planning. Respond with strict JSON only.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
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

    let parsed: { plays?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const validSlugs = new Set(data.leverDefs.map((d) => d.slug));
    const plays: SuggestedPlay[] = [];
    const rawPlays = Array.isArray(parsed.plays) ? parsed.plays : [];
    let idx = 0;
    for (const p of rawPlays) {
      if (!p || typeof p !== "object") continue;
      const rec = p as Record<string, unknown>;
      const id = String(rec.id ?? `ai-play-${idx}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const label = String(rec.label ?? "AI play").slice(0, 60);
      const blurb = String(rec.blurb ?? "").slice(0, 160);
      const thesis = String(rec.thesis ?? "").slice(0, 800);
      const rawMoves = Array.isArray(rec.lever_moves) ? rec.lever_moves : [];
      const moves: SuggestedPlay["lever_moves"] = [];
      for (const mv of rawMoves) {
        if (!mv || typeof mv !== "object") continue;
        const m = mv as Record<string, unknown>;
        const slug = String(m.slug ?? "");
        if (!validSlugs.has(slug)) continue;
        const direction = m.direction === "down" ? "down" : "up";
        const magnitude = Math.max(0, Math.min(1, Number(m.magnitude ?? 0.5)));
        moves.push({ slug, direction, magnitude });
      }
      if (moves.length === 0) continue;
      const rawCites = Array.isArray(rec.citations) ? rec.citations : [];
      const citations = rawCites
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .slice(0, 6)
        .map((c) => ({
          label: String(c.label ?? "").slice(0, 80),
          kind: String(c.kind ?? "misc").slice(0, 20),
          ref: c.ref !== undefined ? String(c.ref).slice(0, 80) : undefined,
        }));
      plays.push({
        id: `ai-${idx}-${id}`.slice(0, 60),
        label,
        blurb,
        thesis,
        citations,
        lever_moves: moves,
      });
      idx++;
    }

    return { plays, note: plays.length === 0 ? "No usable AI plays returned — try Regenerate." : undefined };
  });
