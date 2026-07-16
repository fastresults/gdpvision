import { callSonar, parseSonarJson, type SonarCitation, type SonarModel } from "./perplexity.server";
import { buildCountryContext, contextDomains, renderContextBlock } from "./country-context.server";

type CountryRow = {
  code: string;
  name: string;
  iso3: string | null;
  currency: string;
  gdp_current_usd: number | null;
};

type NodeSide = "input" | "output";

type RegistryNode = {
  node_key: string;
  label: string;
  side: NodeSide;
  sort_order: number;
  gdp_cap_multiplier: number | null;
  preferred_sources?: string[] | null;
};

export type CapitalFlowResolved = {
  node_key: string;
  value_usd_m: number;
  period: string;
  method: "reported" | "derived" | "modelled" | "residual";
  confidence_grade: "A" | "B" | "C";
  source_url: string;
  source_org: string;
  source_kind: "direct" | "derived" | "assumption_based";
  formula?: string;
  notes: string;
  evidence?: Record<string, unknown>;
  validation?: Record<string, unknown>;
};

type Attempt = Partial<CapitalFlowResolved> & {
  node_key: string;
  pass: string;
  provider: string;
  status: "accepted" | "rejected" | "omitted" | "error";
  error?: string | null;
  validation?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
};

const NODE_DEFS: Record<string, { label: string; prompt: string; query: string }> = {
  TOURISM_SPEND: {
    label: "Gross Tourism Spend",
    prompt: "BOP travel credits or gross visitor expenditure from inbound tourism. Prefer ECCB selected tourism statistics, tourism authority, IMF Article IV BOP tables.",
    query: "tourism receipts travel credits visitor expenditure gross tourism spend",
  },
  CBI_INFLOWS: {
    label: "CBI Inflows",
    prompt: "Citizenship-by-Investment fiscal receipts. Omit only if the country has no CBI programme.",
    query: "citizenship by investment receipts revenue CIU CBI budget",
  },
  FDI_NET: {
    label: "Foreign Direct Investment",
    prompt: "Net FDI inflows in USD millions or percent of GDP converted to USD millions.",
    query: "foreign direct investment net inflows FDI balance of payments",
  },
  REMITTANCES: {
    label: "Remittances",
    prompt: "Personal remittances received, BOP secondary income or workers remittances.",
    query: "personal remittances received workers remittances balance of payments",
  },
  ODA_GRANTS: {
    label: "ODA & Grants",
    prompt: "Official development assistance and grant receipts. Prefer OECD DAC, World Bank, CDB/EU/IADB registers, or finance ministry budget grants.",
    query: "official development assistance grants ODA budget grants",
  },
  TAX_REVENUE: {
    label: "Tax Revenue",
    prompt: "Central-government tax revenue collected, excluding grants where a tax-only figure is available.",
    query: "tax revenue central government revenue budget estimates",
  },
  WAGES_AGRI: {
    label: "Local Wages / Agriculture",
    prompt: "Central-government wage bill plus agricultural GVA or a transparent local-retention proxy using public administration and agriculture shares.",
    query: "wage bill personal emoluments agriculture value added gross value added",
  },
  INFRA_CAPEX: {
    label: "Public Works & Infrastructure",
    prompt: "Public capital expenditure on works and infrastructure, excluding health/digital when separable.",
    query: "public sector investment programme infrastructure capital expenditure budget",
  },
  DEBT_SERVICE: {
    label: "External Debt Service",
    prompt: "External public debt service, principal plus interest to non-resident creditors.",
    query: "external debt service public debt principal interest",
  },
  DIGITAL_HEALTH_CAPEX: {
    label: "Digital & Health CapEx",
    prompt: "Public capital expenditure on digital government, health infrastructure, hospitals, equipment, and related projects.",
    query: "health capital expenditure digital government capital budget",
  },
  ENERGY_IMPORT: {
    label: "Energy & Utilities Import",
    prompt: "Mineral fuels HS27 / fuel imports / electricity imports. Can be modelled from total imports with an explicit small-island energy-share assumption when direct data is absent.",
    query: "fuel imports mineral fuels HS27 electricity imports energy imports",
  },
  IMPORT_LEAKAGE: {
    label: "Import Leakages",
    prompt: "Other merchandise/import leakage not captured by energy imports. Can be a reconciliation-derived leakage item when all other uses are known.",
    query: "goods imports merchandise imports import leakage",
  },
};

const INPUT_KEYS = ["TOURISM_SPEND", "CBI_INFLOWS", "FDI_NET", "REMITTANCES", "ODA_GRANTS", "TAX_REVENUE"];
const OUTPUT_KEYS = ["WAGES_AGRI", "INFRA_CAPEX", "DEBT_SERVICE", "DIGITAL_HEALTH_CAPEX", "ENERGY_IMPORT", "IMPORT_LEAKAGE"];

function validUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

function domainOf(raw: string): string | undefined {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function latestPeriod(values: Array<{ period?: string | null; latest_period?: string | null }>, fallback = "2024") {
  const counts = new Map<string, number>();
  for (const v of values) {
    const p = String(v.period ?? v.latest_period ?? "").trim();
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? fallback;
}

function sourceFrom(url: string | null | undefined, fallbackUrl: string | null | undefined, fallbackOrg: string) {
  const resolved = validUrl(url) ? url : validUrl(fallbackUrl) ? fallbackUrl : null;
  return resolved ? { source_url: resolved, source_org: fallbackOrg } : null;
}

async function wbLatest(indicator: string, iso3: string): Promise<{ value: number; period: string; url: string } | null> {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(iso3)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=20&date=2015:2026`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json() as any;
    const rows: Array<{ value: number | null; date: string }> = Array.isArray(json?.[1]) ? json[1] : [];
    const row = rows.find((r) => typeof r.value === "number" && Number.isFinite(r.value));
    if (!row || row.value == null) return null;
    return { value: row.value, period: row.date, url };
  } catch {
    return null;
  }
}

async function loadWorkbook(admin: any, country: CountryRow) {
  const code = country.code;
  const [registryRes, sectorsRes, kpisRes, sourcesRes, memoriesRes, chunksRes, ctx] = await Promise.all([
    admin.from("capital_flow_nodes").select("node_key, label, side, sort_order, gdp_cap_multiplier, preferred_sources").order("sort_order"),
    admin.from("country_sectors").select("sector_code, share_pct, confidence_grade, source_ref").eq("country_code", code),
    admin.from("country_kpis").select("kpi_code, label, latest_value, latest_period, unit, source_url, notes, source_id").eq("country_code", code),
    admin.from("country_sources").select("id, url, title, org, kind, quality_score, active, fetch_status").eq("country_code", code).eq("active", true).order("quality_score", { ascending: false }).limit(40),
    admin.from("memory_objects").select("kind, title, payload, sector_code, weight").eq("scope_key", code).order("weight", { ascending: false }).limit(40),
    admin.from("country_source_chunks").select("content, chunk_index").eq("country_code", code).limit(500),
    buildCountryContext(admin, code),
  ]);

  const registry = (registryRes.data ?? []) as RegistryNode[];
  const sectors = sectorsRes.data ?? [];
  const kpis = kpisRes.data ?? [];
  const sources = sourcesRes.data ?? [];
  const memories = memoriesRes.data ?? [];
  const chunks = chunksRes.data ?? [];
  const gdpUsdM = country.gdp_current_usd ? Number(country.gdp_current_usd) / 1_000_000 : null;
  const byKpi = new Map(kpis.map((k: any) => [String(k.kpi_code), k]));
  const bySector = new Map(sectors.map((s: any) => [String(s.sector_code), s]));
  const defaultSource = sources.find((s: any) => /imf|world bank|statistics|finance|eccb/i.test(`${s.org} ${s.title}`)) ?? sources[0] ?? null;
  const period = latestPeriod(kpis as any[], String(ctx.committed.gdp.gdp_year ?? new Date().getFullYear() - 1));

  const nodeEvidence = Object.fromEntries(
    Object.keys(NODE_DEFS).map((nodeKey) => {
      const terms = NODE_DEFS[nodeKey].query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      const excerptMatches = chunks
        .filter((c: any) => terms.some((t) => String(c.content ?? "").toLowerCase().includes(t)))
        .slice(0, 6)
        .map((c: any) => String(c.content ?? "").slice(0, 900));
      const sourceMatches = sources
        .filter((s: any) => terms.some((t) => `${s.org} ${s.title} ${s.url}`.toLowerCase().includes(t)))
        .slice(0, 6);
      const memoryMatches = memories
        .filter((m: any) => terms.some((t) => `${m.title} ${JSON.stringify(m.payload ?? {})}`.toLowerCase().includes(t)))
        .slice(0, 6);
      return [nodeKey, { excerpts: excerptMatches, sources: sourceMatches, memories: memoryMatches }];
    }),
  );

  return { ctx, registry, sectors, kpis, sources, memories, chunks, byKpi, bySector, defaultSource, gdpUsdM, period, nodeEvidence };
}

function addDerivedFromKpi(args: {
  out: Map<string, CapitalFlowResolved>;
  attempts: Attempt[];
  node_key: string;
  kpi: any;
  gdpUsdM: number;
  multiplier?: number;
  period?: string;
  sourceOrg?: string;
  notes: string;
  confidence?: "A" | "B" | "C";
}) {
  const value = Number(args.kpi?.latest_value);
  if (!Number.isFinite(value)) return;
  const src = sourceFrom(args.kpi?.source_url, null, args.sourceOrg ?? args.kpi?.source_org ?? args.kpi?.label ?? "Committed KPI");
  if (!src) return;
  const val = args.gdpUsdM * value * (args.multiplier ?? 1) / 100;
  const flow: CapitalFlowResolved = {
    node_key: args.node_key,
    value_usd_m: Number(val.toFixed(1)),
    period: String(args.kpi.latest_period ?? args.period ?? ""),
    method: "derived",
    confidence_grade: args.confidence ?? "B",
    source_url: src.source_url,
    source_org: src.source_org,
    source_kind: "derived",
    formula: `GDP_USD_M × ${args.kpi.kpi_code} / 100 = ${args.gdpUsdM.toFixed(1)} × ${value} / 100`,
    notes: args.notes,
    evidence: { kpi_code: args.kpi.kpi_code, kpi_value: value, kpi_unit: args.kpi.unit, kpi_period: args.kpi.latest_period },
  };
  args.out.set(args.node_key, flow);
  args.attempts.push({ ...flow, pass: "deterministic-kpi", provider: "committed-kpi", status: "accepted" });
}

async function deterministicCandidates(workbook: Awaited<ReturnType<typeof loadWorkbook>>, country: CountryRow) {
  const flows = new Map<string, CapitalFlowResolved>();
  const attempts: Attempt[] = [];
  const gdp = workbook.gdpUsdM;
  const iso3 = country.iso3 ?? country.code;
  const fallbackUrl = workbook.defaultSource?.url ?? `https://www.imf.org/en/countries/${iso3}`;

  if (!gdp || gdp <= 0) return { flows, attempts };

  addDerivedFromKpi({
    out: flows,
    attempts,
    node_key: "FDI_NET",
    kpi: workbook.byKpi.get("fdi_net_inflows_gdp"),
    gdpUsdM: gdp,
    notes: "Derived from committed FDI net inflows as a share of GDP.",
  });
  addDerivedFromKpi({
    out: flows,
    attempts,
    node_key: "TAX_REVENUE",
    kpi: workbook.byKpi.get("govt_revenue_gdp"),
    gdpUsdM: gdp,
    notes: "Derived from committed government-revenue KPI as a conservative fiscal-receipts proxy when tax-only budget tables are not available.",
  });

  const remPct = await wbLatest("BX.TRF.PWKR.DT.GD.ZS", iso3);
  if (remPct) {
    const flow: CapitalFlowResolved = {
      node_key: "REMITTANCES",
      value_usd_m: Number((gdp * remPct.value / 100).toFixed(1)),
      period: remPct.period,
      method: "derived",
      confidence_grade: "B",
      source_url: remPct.url,
      source_org: "World Bank WDI",
      source_kind: "derived",
      formula: `GDP_USD_M × personal remittances received (% GDP) / 100 = ${gdp.toFixed(1)} × ${remPct.value} / 100`,
      notes: "Derived from World Bank personal remittances received as a share of GDP.",
      evidence: { indicator: "BX.TRF.PWKR.DT.GD.ZS", source_value: remPct.value, source_unit: "% of GDP" },
    };
    flows.set("REMITTANCES", flow);
    attempts.push({ ...flow, pass: "deterministic-worldbank", provider: "worldbank", status: "accepted" });
  }

  const odaPct = await wbLatest("DT.ODA.ODAT.GN.ZS", iso3);
  if (odaPct && odaPct.value > 0) {
    const flow: CapitalFlowResolved = {
      node_key: "ODA_GRANTS",
      value_usd_m: Number((gdp * odaPct.value / 100).toFixed(1)),
      period: odaPct.period,
      method: "derived",
      confidence_grade: "B",
      source_url: odaPct.url,
      source_org: "World Bank WDI",
      source_kind: "derived",
      formula: `GDP_USD_M × net ODA received (% GNI proxy) / 100 = ${gdp.toFixed(1)} × ${odaPct.value} / 100`,
      notes: "Derived from World Bank ODA share indicator; treated as a grants/ODA proxy for the Sankey ledger.",
      evidence: { indicator: "DT.ODA.ODAT.GN.ZS", source_value: odaPct.value, source_unit: "% of GNI" },
    };
    flows.set("ODA_GRANTS", flow);
    attempts.push({ ...flow, pass: "deterministic-worldbank", provider: "worldbank", status: "accepted" });
  }

  const importsPct = await wbLatest("NE.IMP.GNFS.ZS", iso3);
  if (importsPct && importsPct.value > 0) {
    const totalImports = gdp * importsPct.value / 100;
    const energy = Math.min(totalImports * 0.2, gdp * 0.25);
    const leak = Math.max(0, totalImports - energy);
    const energyFlow: CapitalFlowResolved = {
      node_key: "ENERGY_IMPORT",
      value_usd_m: Number(energy.toFixed(1)),
      period: importsPct.period,
      method: "modelled",
      confidence_grade: "C",
      source_url: importsPct.url,
      source_org: "World Bank WDI",
      source_kind: "assumption_based",
      formula: `min((GDP_USD_M × imports_%GDP / 100) × 20%, GDP_USD_M × 25%)`,
      notes: "Modelled from total imports of goods and services with a small-island fuel/import-share assumption; replace with HS27 customs data when available.",
      evidence: { indicator: "NE.IMP.GNFS.ZS", imports_pct_gdp: importsPct.value, assumed_energy_share_of_imports: 0.2 },
    };
    const leakFlow: CapitalFlowResolved = {
      node_key: "IMPORT_LEAKAGE",
      value_usd_m: Number(leak.toFixed(1)),
      period: importsPct.period,
      method: "derived",
      confidence_grade: "C",
      source_url: importsPct.url,
      source_org: "World Bank WDI",
      source_kind: "derived",
      formula: `GDP_USD_M × imports_%GDP / 100 − ENERGY_IMPORT`,
      notes: "Derived as non-energy import leakage from total imports less modelled energy imports.",
      evidence: { indicator: "NE.IMP.GNFS.ZS", imports_pct_gdp: importsPct.value, total_imports_usd_m: Number(totalImports.toFixed(1)) },
    };
    flows.set("ENERGY_IMPORT", energyFlow);
    flows.set("IMPORT_LEAKAGE", leakFlow);
    attempts.push({ ...energyFlow, pass: "deterministic-worldbank", provider: "worldbank", status: "accepted" });
    attempts.push({ ...leakFlow, pass: "deterministic-worldbank", provider: "worldbank", status: "accepted" });
  }

  const publicAdminSector = workbook.bySector.get("public-administration") as any;
  const agricultureSector = workbook.bySector.get("agriculture") as any;
  const publicAdmin = Number(publicAdminSector?.share_pct ?? 0);
  const agriculture = Number(agricultureSector?.share_pct ?? 0);
  if (publicAdmin + agriculture > 0) {
    const flow: CapitalFlowResolved = {
      node_key: "WAGES_AGRI",
      value_usd_m: Number((gdp * (publicAdmin + agriculture) / 100).toFixed(1)),
      period: workbook.period,
      method: "modelled",
      confidence_grade: "C",
      source_url: fallbackUrl,
      source_org: "Committed sector composition + GDP",
      source_kind: "assumption_based",
      formula: `GDP_USD_M × (public_administration_share + agriculture_share) / 100 = ${gdp.toFixed(1)} × (${publicAdmin} + ${agriculture}) / 100`,
      notes: "Local-retention proxy using committed public-administration and agriculture GDP shares. Replace with budget wage bill plus agriculture GVA when exact tables are available.",
      evidence: { public_administration_share_pct: publicAdmin, agriculture_share_pct: agriculture },
    };
    flows.set("WAGES_AGRI", flow);
    attempts.push({ ...flow, pass: "deterministic-sector", provider: "committed-sector-composition", status: "accepted" });
  }

  const revenueKpi = workbook.byKpi.get("govt_revenue_gdp") as any;
  const capexSource = sourceFrom(revenueKpi?.source_url, fallbackUrl, "IMF / budget assumption");
  if (capexSource) {
    const infra = gdp * 0.015;
    const digitalHealth = gdp * 0.006;
    const debt = gdp * 0.02;
    const capexFlows: CapitalFlowResolved[] = [
      {
        node_key: "INFRA_CAPEX",
        value_usd_m: Number(infra.toFixed(1)),
        period: workbook.period,
        method: "modelled",
        confidence_grade: "C",
        source_url: capexSource.source_url,
        source_org: capexSource.source_org,
        source_kind: "assumption_based",
        formula: "GDP_USD_M × 1.5%",
        notes: "Modelled infrastructure capital expenditure proxy pending detailed public-sector investment tables.",
        evidence: { assumed_share_gdp: 0.015 },
      },
      {
        node_key: "DIGITAL_HEALTH_CAPEX",
        value_usd_m: Number(digitalHealth.toFixed(1)),
        period: workbook.period,
        method: "modelled",
        confidence_grade: "C",
        source_url: capexSource.source_url,
        source_org: capexSource.source_org,
        source_kind: "assumption_based",
        formula: "GDP_USD_M × 0.6%",
        notes: "Modelled digital and health capital-expenditure proxy pending detailed capital-budget tables.",
        evidence: { assumed_share_gdp: 0.006 },
      },
      {
        node_key: "DEBT_SERVICE",
        value_usd_m: Number(debt.toFixed(1)),
        period: workbook.period,
        method: "modelled",
        confidence_grade: "C",
        source_url: capexSource.source_url,
        source_org: capexSource.source_org,
        source_kind: "assumption_based",
        formula: "GDP_USD_M × 2.0%",
        notes: "Modelled external debt-service proxy pending official debt-service schedule.",
        evidence: { assumed_share_gdp: 0.02 },
      },
    ];
    for (const f of capexFlows) {
      flows.set(f.node_key, f);
      attempts.push({ ...f, pass: "deterministic-macro-proxy", provider: "committed-context", status: "accepted" });
    }
  }

  return { flows, attempts };
}

async function aiNodeCandidate(args: {
  country: CountryRow;
  nodeKey: string;
  workbook: Awaited<ReturnType<typeof loadWorkbook>>;
  model: SonarModel;
}): Promise<{ flow: CapitalFlowResolved | null; attempt: Attempt; citations: SonarCitation[] }> {
  const node = NODE_DEFS[args.nodeKey];
  const evidence = (args.workbook.nodeEvidence as any)[args.nodeKey] ?? { excerpts: [], sources: [], memories: [] };
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      applies: { type: "boolean" },
      value_usd_m: { type: ["number", "null"] },
      period: { type: ["string", "null"] },
      method: { type: "string", enum: ["reported", "derived", "modelled"] },
      confidence_grade: { type: "string", enum: ["A", "B", "C"] },
      source_url: { type: ["string", "null"] },
      source_org: { type: ["string", "null"] },
      source_kind: { type: "string", enum: ["direct", "derived", "assumption_based"] },
      formula: { type: ["string", "null"] },
      notes: { type: "string" },
    },
    required: ["applies", "value_usd_m", "period", "method", "confidence_grade", "source_url", "source_org", "source_kind", "notes"],
  } as const;

  try {
    const result = await callSonar({
      model: args.model,
      noDomainFilter: true,
      extraDomains: contextDomains(args.workbook.ctx),
      system:
        "You are a McKinsey-grade sovereign macro analyst building a GDP/capital-flow Sankey ledger. Return one JSON object for exactly one node. Prefer official and multilateral sources. If deriving/modeling, use a real source URL for the underlying assumption and provide the formula. Never use N/A for source_url. If the node genuinely does not apply, set applies=false and value_usd_m=null.\n\n" +
        renderContextBlock(args.workbook.ctx),
      user: `Country: ${args.country.name} (${args.country.iso3 ?? args.country.code}). GDP: US$${args.workbook.gdpUsdM?.toFixed(1) ?? "unknown"}m.\nNode: ${args.nodeKey} — ${node.label}.\nDefinition: ${node.prompt}\n\nCommitted evidence and corpus excerpts:\n${JSON.stringify(evidence).slice(0, 12000)}\n\nReturn the latest complete-period USD millions value.`,
      responseSchema: schema as unknown as Record<string, unknown>,
      recency: "year",
    });
    const parsed = parseSonarJson<any>(result.content);
    if (!parsed?.applies) {
      return { flow: null, citations: result.citations, attempt: { node_key: args.nodeKey, pass: "ai-node", provider: args.model, status: "omitted", evidence, error: parsed?.notes ?? "not applicable" } };
    }
    const value = Number(parsed.value_usd_m);
    const sourceUrl = validUrl(parsed.source_url) ? parsed.source_url : result.citations.find((c) => validUrl(c.url))?.url;
    if (!Number.isFinite(value) || value <= 0 || !sourceUrl) {
      return { flow: null, citations: result.citations, attempt: { node_key: args.nodeKey, pass: "ai-node", provider: args.model, status: "rejected", value_usd_m: Number.isFinite(value) ? value : undefined, source_url: parsed?.source_url ?? null, evidence, error: "AI returned missing/non-positive value or no usable source URL" } };
    }
    const flow: CapitalFlowResolved = {
      node_key: args.nodeKey,
      value_usd_m: Number(value.toFixed(1)),
      period: String(parsed.period ?? args.workbook.period),
      method: parsed.method ?? "modelled",
      confidence_grade: parsed.confidence_grade ?? "C",
      source_url: sourceUrl,
      source_org: parsed.source_org ?? domainOf(sourceUrl) ?? "AI-selected source",
      source_kind: parsed.source_kind ?? (sourceUrl === parsed.source_url ? "direct" : "assumption_based"),
      formula: parsed.formula ?? undefined,
      notes: parsed.notes ?? `${node.label} researched from AI-selected evidence.`,
      evidence,
    };
    return { flow, citations: result.citations, attempt: { ...flow, pass: "ai-node", provider: args.model, status: "accepted" } };
  } catch (err) {
    return { flow: null, citations: [], attempt: { node_key: args.nodeKey, pass: "ai-node", provider: args.model, status: "error", evidence, error: (err as Error).message.slice(0, 500) } };
  }
}

function validateAndReconcile(args: {
  flows: Map<string, CapitalFlowResolved>;
  registry: RegistryNode[];
  gdpUsdM: number | null;
  attempts: Attempt[];
  period: string;
}) {
  const capByKey = new Map(args.registry.map((r) => [r.node_key, Number(r.gdp_cap_multiplier ?? 1.5)]));
  const sideByKey = new Map(args.registry.map((r) => [r.node_key, r.side]));
  const dropped: Array<CapitalFlowResolved & { reason: string }> = [];

  for (const [key, flow] of [...args.flows.entries()]) {
    const cap = capByKey.get(key) ?? 1.5;
    const hardCap = args.gdpUsdM ? cap * args.gdpUsdM : null;
    if (!validUrl(flow.source_url)) {
      dropped.push({ ...flow, reason: "source_url is not valid" });
      args.flows.delete(key);
      args.attempts.push({ ...flow, pass: "validation", provider: "validator", status: "rejected", error: "source_url is not valid" });
      continue;
    }
    if (!Number.isFinite(flow.value_usd_m) || flow.value_usd_m <= 0) {
      dropped.push({ ...flow, reason: "value_usd_m is missing or non-positive" });
      args.flows.delete(key);
      args.attempts.push({ ...flow, pass: "validation", provider: "validator", status: "rejected", error: "value_usd_m is missing or non-positive" });
      continue;
    }
    if (hardCap && flow.value_usd_m > hardCap) {
      const reviewable = flow.source_kind === "direct" && flow.confidence_grade !== "C";
      flow.validation = { ...(flow.validation ?? {}), above_gdp_cap: true, cap_multiplier: cap, reviewable };
      if (!reviewable) {
        dropped.push({ ...flow, reason: `value ${flow.value_usd_m.toFixed(0)}m exceeds ${cap}x GDP (${args.gdpUsdM?.toFixed(0)}m)` });
        args.flows.delete(key);
        args.attempts.push({ ...flow, pass: "validation", provider: "validator", status: "rejected", error: "above GDP cap" });
      }
    }
  }

  const sums = () => {
    let sumIn = 0;
    let sumOut = 0;
    for (const f of args.flows.values()) {
      const side = sideByKey.get(f.node_key);
      if (side === "input") sumIn += f.value_usd_m;
      if (side === "output") sumOut += f.value_usd_m;
    }
    return { sumIn, sumOut };
  };

  let { sumIn, sumOut } = sums();
  const importLeak = args.flows.get("IMPORT_LEAKAGE");
  if (importLeak && sumIn > 0 && sumOut > 0) {
    const othersOut = sumOut - importLeak.value_usd_m;
    const balancedLeak = Math.max(0, sumIn - othersOut);
    if (balancedLeak > 0 && Math.abs(balancedLeak - importLeak.value_usd_m) / Math.max(importLeak.value_usd_m, 1) > 0.1) {
      importLeak.value_usd_m = Number(balancedLeak.toFixed(1));
      importLeak.method = "derived";
      importLeak.source_kind = "derived";
      importLeak.formula = "Total validated inputs − other validated output nodes";
      importLeak.notes = `${importLeak.notes} Reconciled as the balancing non-energy import/leakage bridge after other output nodes were validated.`;
      importLeak.validation = { ...(importLeak.validation ?? {}), reconciliation_balancer: true };
      args.attempts.push({ ...importLeak, pass: "reconciliation", provider: "ledger-validator", status: "accepted" });
    }
  }

  ({ sumIn, sumOut } = sums());
  const residual = sumIn - sumOut;
  const denom = Math.max(sumIn, sumOut);
  const reconciliationPct = denom > 0 ? Math.abs(residual) / denom : 1;
  const inputs = INPUT_KEYS.filter((k) => args.flows.has(k));
  const outputs = OUTPUT_KEYS.filter((k) => args.flows.has(k));
  const missingInputs = INPUT_KEYS.filter((k) => !args.flows.has(k));
  const missingOutputs = OUTPUT_KEYS.filter((k) => !args.flows.has(k));
  const coverageOk = inputs.length >= 3 && outputs.length >= 4 && reconciliationPct <= 0.1;

  return { dropped, inputs, outputs, missingInputs, missingOutputs, sumIn, sumOut, residual, reconciliationPct, coverageOk };
}

async function recordAttempts(admin: any, countryCode: string, runId: string, attempts: Attempt[]) {
  if (!attempts.length) return;
  await admin.from("capital_flow_research_attempts").insert(attempts.map((a) => ({
    country_code: countryCode,
    run_id: runId,
    node_key: a.node_key,
    pass: a.pass,
    provider: a.provider,
    status: a.status,
    value_usd_m: a.value_usd_m ?? null,
    period: a.period ?? null,
    method: a.method ?? null,
    confidence_grade: a.confidence_grade ?? null,
    source_url: a.source_url ?? null,
    source_org: a.source_org ?? null,
    source_kind: a.source_kind ?? null,
    formula: a.formula ?? null,
    evidence: (a.evidence ?? {}) as any,
    validation: (a.validation ?? {}) as any,
    error: a.error ?? null,
  })));
}

export async function buildCapitalFlowsDraft(args: {
  admin: any;
  country: CountryRow;
  runId: string;
  onProgress?: (plan: Record<string, unknown>) => Promise<unknown>;
}) {
  const model: SonarModel = "sonar-reasoning-pro";
  const workbook = await loadWorkbook(args.admin, args.country);
  const attempts: Attempt[] = [];
  const citations: SonarCitation[] = [];
  const reportProgress = async (patch: Record<string, unknown>) => {
    if (!args.onProgress) return;
    try {
      await args.onProgress({
        phase: "capital_flows",
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      /* progress is best-effort */
    }
  };
  await reportProgress({ step: "loading-workbook", processed: 0, total: [...INPUT_KEYS, ...OUTPUT_KEYS].length });
  const deterministic = await deterministicCandidates(workbook, args.country);
  for (const [k, v] of deterministic.flows) workbook.registry.some((r) => r.node_key === k) && deterministic.flows.set(k, v);
  attempts.push(...deterministic.attempts);
  const flows = new Map(deterministic.flows);
  await reportProgress({ step: "deterministic-candidates", processed: flows.size, total: [...INPUT_KEYS, ...OUTPUT_KEYS].length, okCount: flows.size });

  const requiredNodes = [...INPUT_KEYS, ...OUTPUT_KEYS];
  for (let i = 0; i < requiredNodes.length; i++) {
    const nodeKey = requiredNodes[i];
    if (flows.has(nodeKey) && !["TOURISM_SPEND", "CBI_INFLOWS"].includes(nodeKey)) continue;
    if (nodeKey === "CBI_INFLOWS" && !workbook.ctx.isCbiState) {
      attempts.push({ node_key: nodeKey, pass: "country-context", provider: "country-registry", status: "omitted", error: "country is not marked as a CBI state" });
      await reportProgress({ step: "research-node", processed: i + 1, total: requiredNodes.length, currentNode: nodeKey, okCount: flows.size, attempts: attempts.length });
      continue;
    }
    await reportProgress({ step: "research-node", processed: i, total: requiredNodes.length, currentNode: nodeKey, okCount: flows.size, attempts: attempts.length });
    const ai = await aiNodeCandidate({ country: args.country, nodeKey, workbook, model });
    attempts.push(ai.attempt);
    citations.push(...ai.citations);
    if (ai.flow) flows.set(nodeKey, ai.flow);
    await reportProgress({ step: "research-node", processed: i + 1, total: requiredNodes.length, currentNode: nodeKey, okCount: flows.size, attempts: attempts.length });
  }

  const validation = validateAndReconcile({
    flows,
    registry: workbook.registry,
    gdpUsdM: workbook.gdpUsdM,
    attempts,
    period: workbook.period,
  });
  await reportProgress({
    step: "validating",
    processed: requiredNodes.length,
    total: requiredNodes.length,
    okCount: flows.size,
    attempts: attempts.length,
    coverage: { inputs: validation.inputs, outputs: validation.outputs, missingInputs: validation.missingInputs, missingOutputs: validation.missingOutputs, coverageOk: validation.coverageOk },
    reconciliation: { residual: validation.residual, residual_pct: validation.reconciliationPct, sumIn: validation.sumIn, sumOut: validation.sumOut },
  });

  await recordAttempts(args.admin, args.country.code, args.runId, attempts);

  const finalFlows = [...flows.values()].sort((a, b) => requiredNodes.indexOf(a.node_key) - requiredNodes.indexOf(b.node_key));
  const period = latestPeriod(finalFlows, workbook.period);
  const citeMap = new Map<string, SonarCitation>();
  for (const c of citations) if (validUrl(c.url) && !citeMap.has(c.url)) citeMap.set(c.url, c);
  for (const f of finalFlows) if (validUrl(f.source_url) && !citeMap.has(f.source_url)) citeMap.set(f.source_url, { url: f.source_url, domain: domainOf(f.source_url), title: f.source_org });

  const summary_md = validation.coverageOk
    ? `Capital-flow workbook produced a reconciled ${period} Sankey ledger: ${validation.inputs.length} inputs (US$${validation.sumIn.toFixed(0)}m) and ${validation.outputs.length} outputs (US$${validation.sumOut.toFixed(0)}m), residual ${(validation.reconciliationPct * 100).toFixed(1)}%.`
    : `Capital-flow workbook remains incomplete for ${period}: ${validation.inputs.length}/6 inputs, ${validation.outputs.length}/6 outputs, residual ${(validation.reconciliationPct * 100).toFixed(0)}%. Missing: ${[...validation.missingInputs, ...validation.missingOutputs].join(", ") || "—"}.`;
  const summary_highlights = [
    { label: "Period", value: period },
    { label: "Inputs populated", value: `${validation.inputs.length}/6` },
    { label: "Outputs populated", value: `${validation.outputs.length}/6` },
    { label: "Reconciliation", value: `${(validation.reconciliationPct * 100).toFixed(1)}% off` },
    { label: "Research attempts", value: String(attempts.length) },
  ];

  const workbookPayload = {
    country_context: {
      gdp_usd_m: workbook.gdpUsdM,
      period,
      source_count: workbook.sources.length,
      corpus_chunks_sampled: workbook.chunks.length,
      kpi_count: workbook.kpis.length,
      sector_count: workbook.sectors.length,
      memory_count: workbook.memories.length,
    },
    node_evidence: workbook.nodeEvidence,
    attempts_summary: attempts.reduce((acc: Record<string, number>, a) => {
      const key = `${a.status}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };

  return {
    payload: {
      period,
      flows: finalFlows,
      dropped_flows: validation.dropped,
      coverage: { inputs: validation.inputs, outputs: validation.outputs, missingInputs: validation.missingInputs, missingOutputs: validation.missingOutputs, coverageOk: validation.coverageOk },
      reconciliation: { sumIn: validation.sumIn, sumOut: validation.sumOut, residual: validation.residual, residual_pct: validation.reconciliationPct },
      workbook: workbookPayload,
      summary_md,
      summary_highlights,
    },
    citations: [...citeMap.values()],
    confidence: validation.coverageOk ? "high" as const : validation.reconciliationPct < 0.25 ? "medium" as const : "low" as const,
    summary_md,
    summary_highlights,
    count: finalFlows.length,
    reconciliationPct: validation.reconciliationPct,
    coverageOk: validation.coverageOk,
    attempts: attempts.length,
  };
}