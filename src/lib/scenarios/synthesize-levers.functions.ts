// AI Lever Synthesis. Reads the country's second-brain (sectors, KPIs, ministries,
// capital flows, active signals/threats) and asks Gemini for 8–14 bounded policy
// levers grounded in that context. Persists results to `lever_drafts`. A separate
// commit fn writes the reviewed subset into `public.levers`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RESPONSE_FN_REFS = [
  "v1_macro.linear_gdp",
  "v1_macro.exposure_delta",
  "v1_macro.default",
] as const;

const SynthesizeInput = z.object({
  countryCode: z.string().min(3).max(4),
  focus: z.string().max(500).optional(),
  count: z.number().int().min(6).max(16).default(12),
});

const CommitInput = z.object({
  draftId: z.string().uuid(),
  selectedSlugs: z.array(z.string()).min(1),
  edits: z
    .record(
      z.string(),
      z.object({
        name: z.string().min(1).max(120).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        default: z.number().optional(),
      }),
    )
    .optional(),
});

const DraftsInput = z.object({
  countryCode: z.string().min(3).max(4),
  limit: z.number().int().min(1).max(10).default(5),
});

const ActivateLatestInput = z.object({
  countryCode: z.string().min(3).max(4),
});

export interface LeverProposal {
  slug: string;
  name: string;
  sector_code: string;
  unit: string;
  response_fn_ref: (typeof RESPONSE_FN_REFS)[number];
  bounds: { min: number; max: number; default: number };
  rationale: string;
  citations: Array<{ label: string; kind: string; ref?: string }>;
}

export interface LeverDraftSummary {
  id: string;
  country_code: string;
  status: string;
  proposal_count: number;
  created_at: string;
  committed_at: string | null;
  note: string | null;
  sample_names: string[];
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

async function commitLeverRows({
  supabase,
  draftId,
  selectedSlugs,
  edits,
}: {
  supabase: { from: (table: string) => any };
  draftId: string;
  selectedSlugs: string[];
  edits?: Record<string, { name?: string; min?: number; max?: number; default?: number }>;
}): Promise<{ inserted: number }> {
  const { data: draft, error: dErr } = await supabase
    .from("lever_drafts")
    .select("id,country_code,payload,status")
    .eq("id", draftId)
    .maybeSingle();
  if (dErr || !draft) throw new Error(dErr?.message ?? "Draft not found");
  if (draft.status === "committed") throw new Error("Draft already committed");

  const payload = draft.payload as { proposals?: LeverProposal[] };
  const proposals = Array.isArray(payload?.proposals) ? payload.proposals : [];
  const bySlug = new Map(proposals.map((p) => [p.slug, p]));
  const rows: Array<Record<string, unknown>> = [];
  const safeEdits = edits ?? {};

  for (const slug of selectedSlugs) {
    const p = bySlug.get(slug);
    if (!p) continue;
    const edit = safeEdits[slug] ?? {};
    const min = edit.min ?? p.bounds.min;
    const max = edit.max ?? p.bounds.max;
    const dflt = Math.min(max, Math.max(min, edit.default ?? p.bounds.default));
    rows.push({
      country_code: draft.country_code,
      sector_code: p.sector_code,
      slug: p.slug,
      name: edit.name ?? p.name,
      unit: p.unit,
      response_fn_ref: p.response_fn_ref,
      methodology_ref: `ai_synth:${draft.id}`,
      bounds: { min, max, default: dflt },
      rationale: p.rationale,
      citations: p.citations as unknown as never,
      draft_id: draft.id,
    });
  }

  if (rows.length === 0) return { inserted: 0 };

  const { error: upErr } = await supabase
    .from("levers")
    .upsert(rows as never, { onConflict: "country_code,slug" });
  if (upErr) throw new Error(upErr.message);

  await supabase
    .from("lever_drafts")
    .update({ status: "committed", committed_at: new Date().toISOString() })
    .eq("id", draft.id);

  return { inserted: rows.length };
}

export const synthesizeLevers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SynthesizeInput.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ draftId: string; proposals: LeverProposal[]; note?: string }> => {
      const { supabase } = context;

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("Lovable AI Gateway not configured");

      const [
        { data: country },
        { data: sectors },
        { data: kpis },
        { data: ministries },
        { data: flows },
        { data: signals },
      ] = await Promise.all([
        supabase.from("countries").select("name").eq("code", data.countryCode).maybeSingle(),
        supabase
          .from("country_sectors")
          .select("sector_code,share_pct,confidence_grade")
          .eq("country_code", data.countryCode)
          .order("share_pct", { ascending: false })
          .limit(14),
        supabase
          .from("country_kpis")
          .select("kpi_code,label,latest_value,unit,target,direction")
          .eq("country_code", data.countryCode)
          .limit(18),
        supabase
          .from("ministries")
          .select("name,slug,ministry_sectors(sector_code,weight)")
          .eq("country_code", data.countryCode)
          .limit(20),
        supabase
          .from("country_capital_flows")
          .select("node_key,value_usd_m,period")
          .eq("country_code", data.countryCode)
          .limit(20),
        supabase
          .from("intake_items")
          .select("topic,severity,final_weight")
          .eq("scope_key", data.countryCode)
          .order("final_weight", { ascending: false, nullsFirst: false })
          .limit(10),
      ]);

      const sectorSlugs = new Set((sectors ?? []).map((s) => s.sector_code));

      const countryName = country?.name ?? data.countryCode;
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
              `- ${k.kpi_code} ${k.label}: ${k.latest_value ?? "—"}${k.unit ? ` ${k.unit}` : ""} (target ${k.target ?? "—"})`,
          )
          .join("\n") || "- (no KPIs)";
      const ministryList =
        (ministries ?? [])
          .map(
            (m) =>
              `- ${m.name} → sectors: ${(m.ministry_sectors ?? []).map((x) => x.sector_code).join(", ") || "n/a"}`,
          )
          .join("\n") || "- (no ministries)";
      const flowList =
        (flows ?? [])
          .map((f) => `- ${f.node_key} (${f.period}): $${Number(f.value_usd_m ?? 0).toFixed(1)}M`)
          .join("\n") || "- (no capital flow snapshots)";
      const signalList =
        (signals ?? [])
          .map((s) => `- [w${(s.final_weight ?? 0).toFixed?.(1) ?? "?"}] ${s.topic}`)
          .join("\n") || "- (no recent signals)";

      const focusLine = data.focus?.trim()
        ? `Additional user focus: "${data.focus.trim()}"`
        : "";

      const prompt = [
        `You are a McKinsey partner designing the policy-lever surface for the ${countryName} Scenario Engine.`,
        `Propose ${data.count} concrete, bounded policy levers a Cabinet could actually pull.`,
        "Each lever must map to ONE real sector from the country's composition, and reflect the current fiscal / structural reality shown below.",
        "",
        focusLine,
        "",
        "Sector composition:",
        sectorList,
        "",
        "Key KPIs:",
        kpiList,
        "",
        "Ministries and their sector focus:",
        ministryList,
        "",
        "Capital flow snapshot:",
        flowList,
        "",
        "Recent high-priority signals:",
        signalList,
        "",
        "Return STRICT JSON (no prose, no markdown fence) matching:",
        `{
  "levers": [
    {
      "slug": "snake_case, <=40 chars",
      "name": "Human title, <= 60 chars",
      "sector_code": "<one of the sector_code values listed above>",
      "unit": "pct | usd_m | index | pp",
      "response_fn_ref": "v1_macro.linear_gdp | v1_macro.exposure_delta | v1_macro.default",
      "bounds": { "min": <number>, "max": <number>, "default": <number> },
      "rationale": "1-2 sentences why this lever exists, grounded in the data above",
      "citations": [{"label":"human label","kind":"kpi|sector|ministry|flow|signal","ref":"code"}]
    }
  ]
}`,
        "",
        "Rules:",
        "- Only use sector_code values from the sector list above.",
        "- Use v1_macro.exposure_delta ONLY for CBI / concessionary-inflow / debt-exposure style levers.",
        "- Cover a spread of ministries and sectors — do not stack every lever on tourism.",
        "- Bounds must be sensible for the unit (e.g. a share lever in [0,100] with default near status quo).",
        "- default MUST be between min and max.",
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
                "You produce grounded, sovereign-grade policy levers. Respond with strict JSON only.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429)
          throw new Error("AI Gateway rate limit — try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
        throw new Error(`AI Gateway ${res.status}: ${body.slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content?.trim() ?? "{}";
      let parsed: { levers?: unknown } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }

      const proposals: LeverProposal[] = [];
      const usedSlugs = new Set<string>();
      const rawLevers = Array.isArray(parsed.levers) ? parsed.levers : [];
      for (const item of rawLevers) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const slugBase = slugify(String(rec.slug ?? rec.name ?? ""));
        if (!slugBase) continue;
        let slug = slugBase;
        let n = 2;
        while (usedSlugs.has(slug)) slug = `${slugBase}_${n++}`;
        usedSlugs.add(slug);

        const sector = String(rec.sector_code ?? "");
        if (!sectorSlugs.has(sector)) continue;

        const bounds = (rec.bounds ?? {}) as Record<string, unknown>;
        const min = Number(bounds.min);
        const max = Number(bounds.max);
        const dflt = Number(bounds.default);
        if (!isFinite(min) || !isFinite(max) || !isFinite(dflt) || max <= min) continue;
        const clampedDefault = Math.min(max, Math.max(min, dflt));

        const respRef = RESPONSE_FN_REFS.includes(
          rec.response_fn_ref as (typeof RESPONSE_FN_REFS)[number],
        )
          ? (rec.response_fn_ref as (typeof RESPONSE_FN_REFS)[number])
          : "v1_macro.default";

        const rawCites = Array.isArray(rec.citations) ? rec.citations : [];
        const citations = rawCites
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .slice(0, 6)
          .map((c) => ({
            label: String(c.label ?? "").slice(0, 80),
            kind: String(c.kind ?? "misc").slice(0, 20),
            ref: c.ref !== undefined ? String(c.ref).slice(0, 80) : undefined,
          }));

        proposals.push({
          slug,
          name: String(rec.name ?? slug).slice(0, 60),
          sector_code: sector,
          unit: String(rec.unit ?? "pct").slice(0, 20),
          response_fn_ref: respRef,
          bounds: { min, max, default: clampedDefault },
          rationale: String(rec.rationale ?? "").slice(0, 500),
          citations,
        });
      }

      const { data: draft, error } = await supabase
        .from("lever_drafts")
        .insert({
          country_code: data.countryCode,
          status: "draft",
          payload: { proposals } as unknown as never,
          citations: [] as unknown as never,
          note: data.focus ?? null,
        })
        .select("id")
        .single();
      if (error || !draft) throw new Error(error?.message ?? "Failed to persist lever draft");

      return {
        draftId: draft.id,
        proposals,
        note: proposals.length === 0 ? "No usable levers returned — try regenerating." : undefined,
      };
    },
  );

export const listLeverDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DraftsInput.parse(data))
  .handler(async ({ data, context }): Promise<LeverDraftSummary[]> => {
    const { data: rows, error } = await context.supabase
      .from("lever_drafts")
      .select("id,country_code,status,payload,note,created_at,committed_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const payload = r.payload as { proposals?: LeverProposal[] } | null;
      const proposals = Array.isArray(payload?.proposals) ? payload.proposals : [];
      return {
        id: r.id,
        country_code: r.country_code,
        status: r.status,
        proposal_count: proposals.length,
        created_at: r.created_at,
        committed_at: r.committed_at ?? null,
        note: r.note ?? null,
        sample_names: proposals.slice(0, 3).map((p) => p.name || p.slug),
      };
    });
  });

export const activateLatestLeverDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ActivateLatestInput.parse(data))
  .handler(async ({ data, context }): Promise<{ draftId: string; inserted: number }> => {
    const { data: rows, error } = await context.supabase
      .from("lever_drafts")
      .select("id,payload,status")
      .eq("country_code", data.countryCode)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);

    const chosen = (rows ?? []).find((r) => {
      const payload = r.payload as { proposals?: LeverProposal[] } | null;
      return Array.isArray(payload?.proposals) && payload.proposals.length > 0;
    });
    if (!chosen) throw new Error("No usable AI lever draft is ready for this country.");

    const payload = chosen.payload as { proposals?: LeverProposal[] };
    const selectedSlugs = (payload.proposals ?? []).map((p) => p.slug).filter(Boolean);
    if (selectedSlugs.length === 0) throw new Error("The latest draft has no usable levers.");

    const result = await commitLeverRows({
      supabase: context.supabase,
      draftId: chosen.id,
      selectedSlugs,
    });
    return { draftId: chosen.id, inserted: result.inserted };
  });

export const commitLeverDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CommitInput.parse(data))
  .handler(async ({ data, context }): Promise<{ inserted: number }> => {
    return commitLeverRows({
      supabase: context.supabase,
      draftId: data.draftId,
      selectedSlugs: data.selectedSlugs,
      edits: data.edits,
    });
  });
