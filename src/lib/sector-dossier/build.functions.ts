// Context pack + AI brief for a single sector. McKinsey-style pyramid output.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  hasAnyCitableCitation,
  isValidCitationUrl,
  refsFromTextAndModel,
  sanitizeCitationMarkersInText,
  sanitizeJsonCitationMarkers,
  validCitationsForRefs,
  type CitableCitation,
} from "@/lib/citations/hygiene";

const MODEL = "google/gemini-2.5-pro";

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  sectorCode: z.string().min(1).max(64),
  refresh: z.boolean().optional().default(false),
});

export type SectorBrief = {
  headline: string;
  executive: string;
  pyramid: {
    situation: string;
    complication: string;
    resolution: string;
  };
  pillars: Array<{ title: string; kind: "driver" | "risk" | "lever"; bullets: string[] }>;
  outlook: string;
};

export type SectorDossierResult = {
  countryCode: string;
  sectorCode: string;
  sectorLabel: string;
  countryName: string;
  brief: SectorBrief;
  citations: CitableCitation[];
  generated_at: string;
  cached: boolean;
  ministry: { slug: string; name: string; minister: string | null; mandate: string | null } | null;
  kpis: Array<{ kpi_code: string; label: string; unit: string | null; latest: number | null; target: number | null; direction: string | null }>;
  flows: Array<{ label: string; direction: "in" | "out"; magnitude_usd: number | null; note: string | null; url: string | null }>;
  fallback: boolean;
};

async function callGateway(system: string, user: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "{}";
}

function safeParse<T = unknown>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch {} }
    return null;
  }
}

export const buildSectorDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<SectorDossierResult> => {
    const { supabase } = context;
    const { countryCode, sectorCode } = data;

    // ── Country + sector meta ─────────────────────────────────────────────
    const [{ data: country }, { data: sector }, { data: sectorRow }] = await Promise.all([
      supabase.from("countries").select("code,name").eq("code", countryCode).maybeSingle(),
      supabase.from("sectors").select("code,label").eq("code", sectorCode).maybeSingle(),
      supabase.from("country_sectors").select("share_pct,confidence_grade,source_ref").eq("country_code", countryCode).eq("sector_code", sectorCode).maybeSingle(),
    ]);
    const countryName = country?.name ?? countryCode;
    const sectorLabel = sector?.label ?? sectorCode;

    // ── Cache check ───────────────────────────────────────────────────────
    if (!data.refresh) {
      const { data: cached } = await supabase
        .from("sector_dossier_briefs")
        .select("brief,citations,generated_at")
        .eq("country_code", countryCode)
        .eq("sector_code", sectorCode)
        .maybeSingle();
      const cachedAt = cached?.generated_at ? new Date(cached.generated_at).getTime() : 0;
      const ttlOk = cached && Date.now() - cachedAt < 24 * 60 * 60 * 1000;
      if (ttlOk) {
        const bundle = await loadAncillary(supabase, countryCode, sectorCode);
        return {
          countryCode,
          sectorCode,
          sectorLabel,
          countryName,
          brief: cached!.brief as SectorBrief,
          citations: (cached!.citations as CitableCitation[]) ?? [],
          generated_at: cached!.generated_at,
          cached: true,
          fallback: false,
          ...bundle,
        };
      }
    }

    // ── Second-brain assembly ─────────────────────────────────────────────
    const [{ data: dossierRows }, { data: kpiRows }, { data: ministryLinks }, { data: flowRows }, { data: flowNodes }, { data: memories }] = await Promise.all([
      supabase.from("sector_dossiers").select("kind,payload,citations").eq("country_code", countryCode).eq("sector_code", sectorCode).limit(6),
      supabase.from("country_kpis").select("kpi_code,label,latest_value,unit,target,direction,source_url,category").eq("country_code", countryCode).limit(80),
      supabase.from("ministry_sectors").select("weight,ministries!inner(slug,name,country_code)").eq("sector_code", sectorCode).eq("ministries.country_code", countryCode).order("weight", { ascending: false }).limit(3),
      supabase.from("country_capital_flows").select("node_key,value_usd_m,period,notes,citations").eq("country_code", countryCode).order("value_usd_m", { ascending: false }).limit(40),
      supabase.from("capital_flow_nodes").select("node_key,label,side,sector_code,description").eq("sector_code", sectorCode),
      supabase.from("memory_objects").select("id,title,kind,payload,source_id").eq("scope_key", countryCode).eq("sector_code", sectorCode).limit(8),
    ]);

    // Get ministry profile for the top ministry (minister + mandate)
    let ministry: SectorDossierResult["ministry"] = null;
    const topLink = ministryLinks?.[0] as { weight: number | null; ministries: { slug: string; name: string } } | undefined;
    if (topLink) {
      const { data: profile } = await supabase
        .from("ministry_profiles")
        .select("minister,mandate")
        .eq("country_code", countryCode)
        .eq("ministry_slug", topLink.ministries.slug)
        .maybeSingle();
      ministry = {
        slug: topLink.ministries.slug,
        name: topLink.ministries.name,
        minister: profile?.minister ?? null,
        mandate: profile?.mandate ?? null,
      };
    }

    // Build citation registry (deduped by URL)
    const seenUrl = new Set<string>();
    const citations: CitableCitation[] = [];
    const cite = (c: Omit<CitableCitation, "n">): number | null => {
      if (!isValidCitationUrl(c.url)) return null;
      const key = c.url!.trim();
      if (seenUrl.has(key)) {
        const existing = citations.find((x) => x.url === key);
        return existing?.n ?? null;
      }
      seenUrl.add(key);
      const n = citations.length + 1;
      citations.push({ ...c, url: key, n });
      return n;
    };
    const prefix = (n: number | null) => (n ? `[${n}] ` : "");

    // Pull existing dossier citations first (highest priority)
    for (const row of dossierRows ?? []) {
      const arr = Array.isArray(row.citations) ? (row.citations as CitableCitation[]) : [];
      for (const c of arr) cite({ url: c.url ?? null, title: c.title ?? null, org: c.org ?? null, kind: c.kind ?? "source" });
    }
    if (sectorRow?.source_ref && isValidCitationUrl(sectorRow.source_ref)) {
      cite({ url: sectorRow.source_ref, title: `${sectorLabel} — sector share source`, kind: "sector" });
    }

    // Filter KPIs to sector-relevant (loose match on code/label/category)
    const needle = sectorCode.toLowerCase();
    const sectorKpis = (kpiRows ?? []).filter((k) => {
      const s = `${k.kpi_code} ${k.label ?? ""} ${k.category ?? ""}`.toLowerCase();
      return s.includes(needle);
    });
    const kpiForOutput = sectorKpis.slice(0, 10).map((k) => ({
      kpi_code: k.kpi_code,
      label: k.label ?? k.kpi_code,
      unit: k.unit ?? null,
      latest: k.latest_value ?? null,
      target: k.target ?? null,
      direction: k.direction ?? null,
    }));
    const kpiLines = sectorKpis.slice(0, 10).map((k) => {
      const n = cite({ url: k.source_url ?? null, title: k.label ?? k.kpi_code, kind: "kpi" });
      return `- ${prefix(n)}${k.label ?? k.kpi_code}: ${k.latest_value ?? "—"}${k.unit ? ` ${k.unit}` : ""} (target ${k.target ?? "—"}, dir ${k.direction ?? "—"})`;
    });

    // Join flow rows with the sector-scoped node registry.
    const nodeByKey = new Map((flowNodes ?? []).map((n) => [n.node_key, n]));
    const sectorFlows = (flowRows ?? [])
      .filter((f) => nodeByKey.has(f.node_key))
      .map((f) => {
        const node = nodeByKey.get(f.node_key)!;
        const firstCitation = Array.isArray(f.citations) ? (f.citations as Array<Record<string, unknown>>)[0] : null;
        const url = firstCitation && typeof firstCitation.url === "string" ? String(firstCitation.url) : null;
        return {
          node_key: f.node_key,
          label: node.label,
          direction: (node.side === "input" ? "in" : "out") as "in" | "out",
          magnitude_usd: f.value_usd_m ? Number(f.value_usd_m) * 1_000_000 : null,
          note: f.notes ?? null,
          period: f.period,
          url,
        };
      })
      .slice(0, 8);

    const flowLines = sectorFlows.map((f) => {
      const n = cite({ url: f.url, title: f.label, kind: "flow" });
      const mag = f.magnitude_usd ? `$${(f.magnitude_usd / 1_000_000).toFixed(0)}M` : "—";
      return `- ${prefix(n)}${f.direction === "in" ? "IN" : "OUT"} · ${f.label} · ${mag} (${f.period})${f.note ? ` — ${String(f.note).slice(0, 140)}` : ""}`;
    });
    const flowsForOutput = sectorFlows.slice(0, 5).map((f) => ({
      label: f.label,
      direction: f.direction,
      magnitude_usd: f.magnitude_usd,
      note: f.note,
      url: f.url,
    }));

    const memoryLines = (memories ?? []).map((m) => {
      const p = (m.payload ?? {}) as Record<string, unknown>;
      const summary = String(p.summary ?? p.text ?? p.body ?? "").slice(0, 200);
      return `- (${m.kind}) ${m.title}${summary ? ` — ${summary}` : ""}`;
    });

    const dossierLines = (dossierRows ?? []).map((d) => {
      const p = (d.payload ?? {}) as Record<string, unknown>;
      const summary = String(p.summary ?? p.narrative ?? p.overview ?? "").slice(0, 500);
      return `- (${d.kind}) ${summary || "(no narrative)"}`;
    });

    const block = [
      `COUNTRY: ${countryName} (${countryCode})`,
      `SECTOR: ${sectorLabel} (${sectorCode})`,
      `GDP SHARE: ${sectorRow?.share_pct ?? "—"}%  ·  GRADE: ${sectorRow?.confidence_grade ?? "—"}`,
      ministry ? `LEAD MINISTRY: ${ministry.name}${ministry.minister ? ` — Minister ${ministry.minister}` : ""}` : "",
      ministry?.mandate ? `MANDATE EXCERPT: ${String(ministry.mandate).slice(0, 400)}` : "",
      "",
      "SECTOR KPIs (cite these):",
      kpiLines.join("\n") || "- (none)",
      "",
      "CAPITAL FLOWS (cite these):",
      flowLines.join("\n") || "- (none)",
      "",
      "COMMITTED SECTOR DOSSIER SNIPPETS:",
      dossierLines.join("\n") || "- (none)",
      "",
      "SECOND-BRAIN MEMORY:",
      memoryLines.join("\n") || "- (none)",
      "",
      "CITATION RULE: only cite bracketed [N] lines above. Never invent citations.",
    ].filter(Boolean).join("\n");

    // ── AI call ───────────────────────────────────────────────────────────
    let brief: SectorBrief | null = null;
    let fallback = false;
    try {
      const raw = await callGateway(
        "You are a McKinsey partner writing sovereign sector briefs for a head of government. Be crisp, evidence-first, and use the Pyramid Principle. Cite [N] refs matching the provided context. Never invent a citation. Return strict JSON only.",
        `Write a McKinsey-grade brief on the ${sectorLabel} sector for ${countryName}.

${block}

Return JSON exactly matching:
{
  "headline": "one-sentence, action-oriented headline (max 20 words), cite [N] where relevant",
  "executive": "3-4 sentence executive summary in the McKinsey situation→complication→resolution rhythm. Cite [N] refs.",
  "pyramid": {
    "situation": "2 sentences on the sector's current position",
    "complication": "2 sentences on the tension, gap or shock",
    "resolution": "2 sentences on what leadership should do next"
  },
  "pillars": [
    { "title": "Growth drivers", "kind": "driver", "bullets": ["…[N]", "…[N]", "…"] },
    { "title": "Downside risks", "kind": "risk", "bullets": ["…[N]", "…", "…"] },
    { "title": "Policy levers", "kind": "lever", "bullets": ["…[N]", "…", "…"] }
  ],
  "outlook": "2-3 sentences with a 12-24 month outlook and one leading indicator to watch.",
  "grounding_refs": [1,2,3]
}
Rules: exactly 3 pillars in that order; 2-4 bullets each; every claim that isn't obvious needs a [N] ref from the context.`,
      );
      const parsed = safeParse<Record<string, unknown> & { grounding_refs?: unknown }>(raw);
      if (parsed && typeof parsed.headline === "string") {
        const allText = [
          parsed.headline, parsed.executive, parsed.outlook,
          JSON.stringify(parsed.pyramid ?? {}),
          JSON.stringify(parsed.pillars ?? []),
        ].join(" ");
        const refs = refsFromTextAndModel(String(allText), parsed.grounding_refs);
        const validCitations = validCitationsForRefs(citations, refs);
        const clean = sanitizeJsonCitationMarkers(parsed, validCitations) as Record<string, unknown>;
        brief = {
          headline: String(clean.headline ?? "").slice(0, 300),
          executive: String(clean.executive ?? "").slice(0, 1500),
          pyramid: {
            situation: String((clean.pyramid as any)?.situation ?? "").slice(0, 800),
            complication: String((clean.pyramid as any)?.complication ?? "").slice(0, 800),
            resolution: String((clean.pyramid as any)?.resolution ?? "").slice(0, 800),
          },
          pillars: Array.isArray(clean.pillars)
            ? (clean.pillars as Array<Record<string, unknown>>).slice(0, 3).map((p) => ({
                title: String(p.title ?? "").slice(0, 80),
                kind: (["driver", "risk", "lever"].includes(String(p.kind)) ? p.kind : "driver") as "driver" | "risk" | "lever",
                bullets: (Array.isArray(p.bullets) ? p.bullets : []).slice(0, 5).map((b) => String(b).slice(0, 400)),
              }))
            : [],
          outlook: String(clean.outlook ?? "").slice(0, 800),
        };
        // Persist cache
        await supabase.from("sector_dossier_briefs").upsert({
          country_code: countryCode,
          sector_code: sectorCode,
          brief: brief as never,
          citations: validCitations as never,
          generated_at: new Date().toISOString(),
        }, { onConflict: "country_code,sector_code" });
        return {
          countryCode,
          sectorCode,
          sectorLabel,
          countryName,
          brief,
          citations: validCitations,
          generated_at: new Date().toISOString(),
          cached: false,
          fallback: false,
          ministry,
          kpis: kpiForOutput,
          flows: flowsForOutput,
        };
      }
    } catch (err) {
      fallback = true;
      // fall through
    }

    // Degrade gracefully
    return {
      countryCode,
      sectorCode,
      sectorLabel,
      countryName,
      brief: {
        headline: `${sectorLabel} · ${countryName}`,
        executive: "The AI-generated brief is temporarily unavailable. The panels below show the live sector data from the country's second brain.",
        pyramid: { situation: "", complication: "", resolution: "" },
        pillars: [],
        outlook: "",
      },
      citations: [],
      generated_at: new Date().toISOString(),
      cached: false,
      fallback: true,
      ministry,
      kpis: kpiForOutput,
      flows: flowsForOutput,
    };
  });

async function loadAncillary(supabase: any, countryCode: string, sectorCode: string) {
  const [{ data: kpiRows }, { data: ministryLinks }, { data: flowRows }, { data: flowNodes }] = await Promise.all([
    supabase.from("country_kpis").select("kpi_code,label,latest_value,unit,target,direction,category").eq("country_code", countryCode).limit(80),
    supabase.from("ministry_sectors").select("weight,ministries!inner(slug,name,country_code)").eq("sector_code", sectorCode).eq("ministries.country_code", countryCode).order("weight", { ascending: false }).limit(3),
    supabase.from("country_capital_flows").select("node_key,value_usd_m,period,notes,citations").eq("country_code", countryCode).order("value_usd_m", { ascending: false }).limit(40),
    supabase.from("capital_flow_nodes").select("node_key,label,side,sector_code").eq("sector_code", sectorCode),
  ]);
  const needle = sectorCode.toLowerCase();
  const kpis = (kpiRows ?? []).filter((k: any) => `${k.kpi_code} ${k.label ?? ""} ${k.category ?? ""}`.toLowerCase().includes(needle)).slice(0, 10).map((k: any) => ({
    kpi_code: k.kpi_code, label: k.label ?? k.kpi_code, unit: k.unit ?? null, latest: k.latest_value ?? null, target: k.target ?? null, direction: k.direction ?? null,
  }));
  let ministry: SectorDossierResult["ministry"] = null;
  const topLink = ministryLinks?.[0] as any;
  if (topLink) {
    const { data: profile } = await supabase.from("ministry_profiles").select("minister,mandate").eq("country_code", countryCode).eq("ministry_slug", topLink.ministries.slug).maybeSingle();
    ministry = { slug: topLink.ministries.slug, name: topLink.ministries.name, minister: profile?.minister ?? null, mandate: profile?.mandate ?? null };
  }
  const nodeByKey = new Map((flowNodes ?? []).map((n: any) => [n.node_key, n]));
  const flowsForOutput = (flowRows ?? [])
    .filter((f: any) => nodeByKey.has(f.node_key))
    .slice(0, 5)
    .map((f: any) => {
      const node = nodeByKey.get(f.node_key) as any;
      const firstCitation = Array.isArray(f.citations) ? (f.citations as Array<any>)[0] : null;
      const url = firstCitation && typeof firstCitation.url === "string" ? String(firstCitation.url) : null;
      return {
        label: node.label,
        direction: (node.side === "input" ? "in" : "out") as "in" | "out",
        magnitude_usd: f.value_usd_m ? Number(f.value_usd_m) * 1_000_000 : null,
        note: f.notes ?? null,
        url: isValidCitationUrl(url) ? url : null,
      };
    });
  return { ministry, kpis, flows: flowsForOutput };
}

// Silence unused import warning; the helper is used above.
void hasAnyCitableCitation;
void sanitizeCitationMarkersInText;

