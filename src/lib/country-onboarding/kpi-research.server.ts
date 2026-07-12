// Multi-pass KPI research helpers. Server-only.
//
// The pipeline runs up to N passes per KPI until coverage is 100%:
//   A. broad Perplexity sweep      (callSonar structured, all KPIs at once)
//   B. deterministic World Bank    (open API)
//   C. deterministic IMF WEO       (open API)
//   D. per-KPI targeted Perplexity (single-object schema)
//   E. Gemini escalation via Lovable AI Gateway (different provider)
//
// Every attempt is written to `kpi_research_attempts` so operators can see
// exactly why a KPI is empty.

import {
  findRegistryEntry,
  isPlausible,
  type KpiRegistryEntry,
} from "./kpi-registry";
import { callSonar, parseSonarJson } from "./perplexity.server";

export type ResearchedValue = {
  kpi_code: string;
  value: number | null;
  period: string | null;
  source_url: string | null;
  source_org: string | null;
  notes: string;
};

export type AttemptRecord = {
  kpi_code: string;
  pass: "sweep" | "worldbank" | "imf" | "targeted" | "escalation";
  provider: "perplexity" | "worldbank" | "imf" | "lovable-ai";
  model?: string;
  ok: boolean;
  value: number | null;
  period: string | null;
  source_url: string | null;
  error: string | null;
};

export function coverageOf(
  registry: KpiRegistryEntry[],
  values: Map<string, ResearchedValue>,
): { total: number; filled: number; missing: string[] } {
  const required = registry.filter((k) => k.required);
  const filled = required.filter((k) => {
    const v = values.get(k.kpi_code);
    return v && v.value != null;
  });
  const missing = required
    .filter((k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null)
    .map((k) => k.kpi_code);
  return { total: required.length, filled: filled.length, missing };
}

// ============================================================
// Pass A — broad Perplexity sweep
// ============================================================

function buildSweepSchema(registry: KpiRegistryEntry[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      kpis: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            kpi_code: { type: "string", enum: registry.map((k) => k.kpi_code) },
            value: { type: ["number", "null"] },
            period: { type: ["string", "null"] },
            source_url: { type: ["string", "null"] },
            source_org: { type: ["string", "null"] },
            notes: { type: "string" },
          },
          required: ["kpi_code", "value", "period", "source_url", "notes"],
        },
      },
    },
    required: ["kpis"],
  } as const;
}

export async function sweepPerplexity(args: {
  country: { name: string; iso3: string | null; code: string };
  registry: KpiRegistryEntry[];
  countryTld?: string;
}): Promise<{ values: ResearchedValue[]; attempts: AttemptRecord[] }> {
  const attempts: AttemptRecord[] = [];
  try {
    const catalog = args.registry
      .map(
        (k) =>
          `- ${k.kpi_code} (${k.label}) — ${k.unit}, prefer ${k.authoritative_orgs.join(" / ")}`,
      )
      .join("\n");
    const result = await callSonar({
      model: "sonar-pro",
      system:
        "You are a rigorous national statistics analyst. For each KPI in the target list, return the most recent authoritative value with the period and the exact source URL. Prefer the listed authoritative organisations. If a KPI is genuinely unknown, set value to null and explain why in notes — never fabricate. Use snake_case kpi_code exactly as given.",
      user: `Country: ${args.country.name} (${args.country.iso3 ?? args.country.code}).\n\nTarget KPIs (return one entry per code):\n${catalog}`,
      responseSchema: buildSweepSchema(args.registry) as unknown as Record<string, unknown>,
      recency: "year",
      countryTld: args.countryTld,
    });
    const parsed = parseSonarJson<{ kpis: ResearchedValue[] }>(result.content);
    const values = (parsed?.kpis ?? []).map((k) => normalizeValue(k));
    for (const v of values) {
      attempts.push({
        kpi_code: v.kpi_code,
        pass: "sweep",
        provider: "perplexity",
        model: "sonar-pro",
        ok: v.value != null,
        value: v.value,
        period: v.period,
        source_url: v.source_url,
        error: v.value == null ? v.notes || "no value" : null,
      });
    }
    return { values, attempts };
  } catch (err) {
    attempts.push({
      kpi_code: "*",
      pass: "sweep",
      provider: "perplexity",
      model: "sonar-pro",
      ok: false,
      value: null,
      period: null,
      source_url: null,
      error: (err as Error).message.slice(0, 500),
    });
    return { values: [], attempts };
  }
}

// ============================================================
// Pass B — World Bank open API
// ============================================================

export async function backfillWorldBank(
  iso3: string,
  kpi: KpiRegistryEntry,
): Promise<{ value: ResearchedValue | null; attempt: AttemptRecord }> {
  if (!kpi.wb_indicator) {
    return {
      value: null,
      attempt: {
        kpi_code: kpi.kpi_code,
        pass: "worldbank",
        provider: "worldbank",
        ok: false,
        value: null,
        period: null,
        source_url: null,
        error: "no wb_indicator in registry",
      },
    };
  }
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(iso3)}/indicator/${encodeURIComponent(kpi.wb_indicator)}?format=json&per_page=15&date=2015:2026`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WB ${res.status}`);
    const json = (await res.json()) as any;
    const rows: Array<{ value: number | null; date: string }> = Array.isArray(json?.[1]) ? json[1] : [];
    const latest = rows.find((r) => r.value != null);
    if (!latest) throw new Error("no non-null observation in 2015-2026 window");
    const sourceUrl = `https://data.worldbank.org/indicator/${kpi.wb_indicator}?locations=${iso3}`;
    return {
      value: {
        kpi_code: kpi.kpi_code,
        value: latest.value,
        period: latest.date,
        source_url: sourceUrl,
        source_org: "World Bank",
        notes: `World Bank WDI (${kpi.wb_indicator})`,
      },
      attempt: {
        kpi_code: kpi.kpi_code,
        pass: "worldbank",
        provider: "worldbank",
        ok: true,
        value: latest.value,
        period: latest.date,
        source_url: sourceUrl,
        error: null,
      },
    };
  } catch (err) {
    return {
      value: null,
      attempt: {
        kpi_code: kpi.kpi_code,
        pass: "worldbank",
        provider: "worldbank",
        ok: false,
        value: null,
        period: null,
        source_url: null,
        error: (err as Error).message.slice(0, 300),
      },
    };
  }
}

// ============================================================
// Pass C — IMF WEO (via IMF DataMapper open API)
// ============================================================

export async function backfillImf(
  iso3: string,
  kpi: KpiRegistryEntry,
): Promise<{ value: ResearchedValue | null; attempt: AttemptRecord }> {
  if (!kpi.imf_indicator) {
    return {
      value: null,
      attempt: {
        kpi_code: kpi.kpi_code,
        pass: "imf",
        provider: "imf",
        ok: false,
        value: null,
        period: null,
        source_url: null,
        error: "no imf_indicator in registry",
      },
    };
  }
  const url = `https://www.imf.org/external/datamapper/api/v1/${encodeURIComponent(kpi.imf_indicator)}/${encodeURIComponent(iso3)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`IMF ${res.status}`);
    const json = (await res.json()) as any;
    const series = json?.values?.[kpi.imf_indicator]?.[iso3] as Record<string, number> | undefined;
    if (!series) throw new Error("no series for country");
    // Pick most recent year with a numeric value.
    const years = Object.keys(series)
      .filter((y) => typeof series[y] === "number" && Number.isFinite(series[y]))
      .sort((a, b) => Number(b) - Number(a));
    const latestYear = years[0];
    if (!latestYear) throw new Error("no numeric observations");
    const val = series[latestYear];
    const sourceUrl = `https://www.imf.org/external/datamapper/${kpi.imf_indicator}@WEO/${iso3}`;
    return {
      value: {
        kpi_code: kpi.kpi_code,
        value: val,
        period: latestYear,
        source_url: sourceUrl,
        source_org: "IMF WEO",
        notes: `IMF DataMapper WEO (${kpi.imf_indicator})`,
      },
      attempt: {
        kpi_code: kpi.kpi_code,
        pass: "imf",
        provider: "imf",
        ok: true,
        value: val,
        period: latestYear,
        source_url: sourceUrl,
        error: null,
      },
    };
  } catch (err) {
    return {
      value: null,
      attempt: {
        kpi_code: kpi.kpi_code,
        pass: "imf",
        provider: "imf",
        ok: false,
        value: null,
        period: null,
        source_url: null,
        error: (err as Error).message.slice(0, 300),
      },
    };
  }
}

// ============================================================
// Pass D — targeted Perplexity for one KPI
// ============================================================

const SingleValueSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["number", "null"] },
    period: { type: ["string", "null"] },
    source_url: { type: ["string", "null"] },
    source_org: { type: ["string", "null"] },
    reason_if_missing: { type: "string" },
  },
  required: ["value", "period", "source_url", "reason_if_missing"],
} as const;

export async function targetedPerplexity(args: {
  country: { name: string; iso3: string | null; code: string };
  kpi: KpiRegistryEntry;
  countryTld?: string;
}): Promise<{ value: ResearchedValue | null; attempt: AttemptRecord }> {
  try {
    const result = await callSonar({
      model: "sonar-pro",
      system: `You are a national statistics researcher. Return ONLY the latest authoritative value for one specific KPI. Prefer these sources in order: ${args.kpi.authoritative_orgs.join(", ")}. If you cannot find a plausible authoritative value, set value to null and explain in reason_if_missing.`,
      user: `Country: ${args.country.name} (${args.country.iso3 ?? args.country.code}).\nKPI: ${args.kpi.label} (${args.kpi.kpi_code}), unit ${args.kpi.unit}.\nReturn the latest value with the period (${args.kpi.expected_period_shape}) and the exact source URL.`,
      responseSchema: SingleValueSchema as unknown as Record<string, unknown>,
      recency: "year",
      countryTld: args.countryTld,
    });
    const parsed = parseSonarJson<{
      value: number | null;
      period: string | null;
      source_url: string | null;
      source_org: string | null;
      reason_if_missing: string;
    }>(result.content);
    if (!parsed || parsed.value == null) {
      return {
        value: null,
        attempt: {
          kpi_code: args.kpi.kpi_code,
          pass: "targeted",
          provider: "perplexity",
          model: "sonar-pro",
          ok: false,
          value: null,
          period: parsed?.period ?? null,
          source_url: parsed?.source_url ?? null,
          error: parsed?.reason_if_missing || "no value returned",
        },
      };
    }
    return {
      value: {
        kpi_code: args.kpi.kpi_code,
        value: parsed.value,
        period: parsed.period,
        source_url: parsed.source_url,
        source_org: parsed.source_org ?? null,
        notes: "Targeted Perplexity",
      },
      attempt: {
        kpi_code: args.kpi.kpi_code,
        pass: "targeted",
        provider: "perplexity",
        model: "sonar-pro",
        ok: true,
        value: parsed.value,
        period: parsed.period,
        source_url: parsed.source_url,
        error: null,
      },
    };
  } catch (err) {
    return {
      value: null,
      attempt: {
        kpi_code: args.kpi.kpi_code,
        pass: "targeted",
        provider: "perplexity",
        model: "sonar-pro",
        ok: false,
        value: null,
        period: null,
        source_url: null,
        error: (err as Error).message.slice(0, 400),
      },
    };
  }
}

// ============================================================
// Pass E — Gemini escalation via Lovable AI Gateway
// ============================================================

export async function escalateGemini(args: {
  country: { name: string; iso3: string | null; code: string };
  kpi: KpiRegistryEntry;
}): Promise<{ value: ResearchedValue | null; attempt: AttemptRecord }> {
  const key = process.env.LOVABLE_API_KEY;
  const model = "google/gemini-2.5-pro";
  if (!key) {
    return {
      value: null,
      attempt: {
        kpi_code: args.kpi.kpi_code,
        pass: "escalation",
        provider: "lovable-ai",
        model,
        ok: false,
        value: null,
        period: null,
        source_url: null,
        error: "LOVABLE_API_KEY not configured",
      },
    };
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are a national statistics researcher. Return ONE JSON object matching this schema, no prose, no code fence: {"value": number|null, "period": string|null, "source_url": string|null, "source_org": string|null, "reason_if_missing": string}. Prefer authoritative sources: ${args.kpi.authoritative_orgs.join(", ")}. Do not fabricate; use null with reason if unknown.`,
          },
          {
            role: "user",
            content: `Country: ${args.country.name} (${args.country.iso3 ?? args.country.code}). KPI: ${args.kpi.label} (${args.kpi.kpi_code}), unit ${args.kpi.unit}. Expected period shape ${args.kpi.expected_period_shape}. Return the latest authoritative value with period and source URL.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content ?? "";
    const parsed = parseGeminiJson(content);
    if (!parsed || parsed.value == null) {
      return {
        value: null,
        attempt: {
          kpi_code: args.kpi.kpi_code,
          pass: "escalation",
          provider: "lovable-ai",
          model,
          ok: false,
          value: null,
          period: parsed?.period ?? null,
          source_url: parsed?.source_url ?? null,
          error: parsed?.reason_if_missing || "no value returned",
        },
      };
    }
    return {
      value: {
        kpi_code: args.kpi.kpi_code,
        value: parsed.value,
        period: parsed.period,
        source_url: parsed.source_url,
        source_org: parsed.source_org ?? null,
        notes: "Gemini escalation",
      },
      attempt: {
        kpi_code: args.kpi.kpi_code,
        pass: "escalation",
        provider: "lovable-ai",
        model,
        ok: true,
        value: parsed.value,
        period: parsed.period,
        source_url: parsed.source_url,
        error: null,
      },
    };
  } catch (err) {
    return {
      value: null,
      attempt: {
        kpi_code: args.kpi.kpi_code,
        pass: "escalation",
        provider: "lovable-ai",
        model,
        ok: false,
        value: null,
        period: null,
        source_url: null,
        error: (err as Error).message.slice(0, 400),
      },
    };
  }
}

function parseGeminiJson(content: string): {
  value: number | null;
  period: string | null;
  source_url: string | null;
  source_org: string | null;
  reason_if_missing: string;
} | null {
  if (!content) return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? content).trim();
  const start = raw.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(raw.slice(start));
  } catch {
    return null;
  }
}

// ============================================================
// Sanity + merge
// ============================================================

export function normalizeValue(v: ResearchedValue): ResearchedValue {
  const entry = findRegistryEntry(v.kpi_code);
  if (!entry) return v;
  if (v.value != null && !isPlausible(v.kpi_code, v.value)) {
    return { ...v, value: null, notes: `${v.notes} · dropped: out of bounds (${entry.value_bounds.min}..${entry.value_bounds.max})` };
  }
  return v;
}

/**
 * Merge helper — new value wins only if the slot is currently empty (value == null).
 * Passes are called in confidence order; the first one that fills a slot keeps it.
 */
export function mergeInto(
  map: Map<string, ResearchedValue>,
  incoming: ResearchedValue,
): boolean {
  const cur = map.get(incoming.kpi_code);
  if (cur && cur.value != null) return false;
  map.set(incoming.kpi_code, incoming);
  return incoming.value != null;
}
