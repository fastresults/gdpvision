// @domain investments
// @tables investment_projects,countries,country_kpis
// @ui src/components/investments/packages/InvestorPackagesPanel.tsx
//
// Gathers the facts an investor package may use, and builds the data-room
// index from them. Server-only.
//
// The facts object is the whole universe of a package: the model sees nothing
// else, the number guard checks against nothing else, and the exact object is
// stored with the package so a reviewer can see what it was written from.
//
// Included: the project's public fields, the country name, up to ten headline
// public country indicators with period and source, and the readiness checks
// as pass/fail. Never included: beneficial owners, AML records or any other
// content of the restricted compliance record.

import { db, type AnyClient } from "@/lib/syndication/db";
import {
  APPROVAL_LABEL,
  STAGE_LABEL,
  hasContent,
  readinessChecks,
} from "@/lib/investments/readiness";

import {
  TO_BE_CONFIRMED,
  type DataRoomContent,
  type DataRoomStatus,
  type FactItem,
  type PackageFacts,
  type PackageFigure,
} from "./package-schema";

// ------------------------------------------------------------------ formatting

const nf = (v: number, digits = 0) =>
  v.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatUsd(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `US$${nf(v / 1e9, 2)} billion`;
  if (a >= 1e6) return `US$${nf(v / 1e6, 1)} million`;
  return `US$${nf(v, 0)}`;
}

function formatKpi(value: number, unit: string | null | undefined): string {
  const u = (unit ?? "").trim().toLowerCase();
  if (u.includes("%") || u.includes("percent") || u === "pct") return `${nf(value, 1)}%`;
  if (u.includes("usd") || u.includes("us$") || u === "$") return formatUsd(value);
  const digits = Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 1;
  const n = nf(value, digits);
  if (!u || ["count", "number", "persons", "people", "people (count)", "index"].includes(u))
    return n;
  return `${n} ${unit}`;
}

const text = (v: string | null | undefined) => (hasContent(v) ? String(v).trim() : null);

// ------------------------------------------------------------------ headline indicators

/** The indicators an investor expects on page one, in order, matched by code first then label. */
const HEADLINE_KPIS: Array<{ key: string; codes: string[]; label: RegExp; exclude?: RegExp }> = [
  {
    key: "real_gdp_growth",
    codes: ["real_gdp_growth", "gdp_growth", "gdp_real_growth"],
    label: /\b(real )?gdp growth\b/i,
  },
  {
    key: "gdp_current_usd",
    codes: ["gdp_current_usd", "gdp_usd", "gdp_nominal_usd"],
    label: /^(nominal )?gdp\b(?!.*(growth|per capita|share))/i,
  },
  {
    key: "gdp_per_capita",
    codes: ["gdp_per_capita_current_usd", "gdp_per_capita", "gdp_pc"],
    label: /gdp per capita/i,
    exclude: /ppp/i,
  },
  { key: "population", codes: ["population"], label: /^population\b/i },
  {
    key: "cpi_inflation",
    codes: ["cpi_yoy", "inflation", "cpi_inflation", "cpi"],
    label: /inflation|consumer price/i,
  },
  {
    key: "debt_gdp",
    codes: ["debt_gdp", "debt_to_gdp", "public_debt_gdp", "govt_debt_gdp"],
    label: /debt.*gdp/i,
  },
  {
    key: "current_account_gdp",
    codes: ["current_account_gdp", "current_account_pct_gdp"],
    label: /current account/i,
  },
  {
    key: "fdi_gdp",
    codes: ["fdi_net_inflows_gdp", "fdi_gdp", "fdi_inflows_gdp"],
    label: /foreign direct investment|\bfdi\b/i,
  },
  {
    key: "tourism_arrivals",
    codes: ["tourism_arrivals", "stayover_arrivals", "tourist_arrivals", "arrivals"],
    label: /arrivals/i,
  },
  {
    key: "unemployment_rate",
    codes: ["unemployment_rate", "unemployment"],
    label: /unemployment/i,
  },
];

type KpiRow = {
  kpi_code: string;
  label: string;
  unit: string;
  latest_value: number | null;
  latest_period: string | null;
  source_url: string | null;
};

// ------------------------------------------------------------------ facts

export async function gatherPackageFacts(
  sb: AnyClient,
  code: string,
  projectId: string,
): Promise<PackageFacts> {
  const c = db(sb);
  const [{ data: project, error: pErr }, { data: country }, { data: kpis }] = await Promise.all([
    c
      .from("investment_projects")
      .select(
        "id,country_code,title,sector,structure,stage,capex_usd,summary,revenue_model,sponsor,es_category,climate_alignment,risks,feasibility_done,land_secured,bo_disclosed,aml_cleared,version,approval_status",
      )
      .eq("id", projectId)
      .eq("country_code", code)
      .maybeSingle(),
    c.from("countries").select("code,name").eq("code", code).maybeSingle(),
    c
      .from("country_kpis")
      .select("kpi_code,label,unit,latest_value,latest_period,source_url")
      .eq("country_code", code)
      .eq("visibility", "public")
      .not("latest_value", "is", null)
      .limit(400),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (!project) throw new Error("Project not found for this country.");
  const p = project as Record<string, unknown>;
  const countryName = ((country as { name?: string } | null)?.name ?? code).trim();

  const items: Record<string, FactItem> = {};
  const put = (f: FactItem) => {
    items[f.key] = f;
  };
  const projText = (key: string, label: string) => {
    const v = text(p[key] as string | null);
    put({
      key: `project.${key}`,
      label,
      group: "project",
      value: v,
      display: v ?? TO_BE_CONFIRMED,
    });
  };

  put({
    key: "country.name",
    label: "Country",
    group: "country",
    value: countryName,
    display: countryName,
  });

  projText("title", "Project title");
  projText("sector", "Sector");
  projText("structure", "Transaction structure");
  const stage = String(p.stage ?? "concept") as keyof typeof STAGE_LABEL;
  put({
    key: "project.stage",
    label: "Stage",
    group: "project",
    value: stage,
    display: STAGE_LABEL[stage] ?? stage,
  });
  const capex = Number(p.capex_usd ?? 0);
  put({
    key: "project.capex_usd",
    label: "Capital cost",
    group: "project",
    value: Number.isFinite(capex) && capex > 0 ? capex : null,
    display: Number.isFinite(capex) && capex > 0 ? formatUsd(capex) : TO_BE_CONFIRMED,
    unit: "USD",
  });
  projText("summary", "Summary");
  projText("revenue_model", "Revenue model");
  projText("sponsor", "Sponsor");
  const es = typeof p.es_category === "string" ? p.es_category : null;
  put({
    key: "project.es_category",
    label: "IFC environmental and social category",
    group: "project",
    value: es,
    display: es
      ? es === "FI"
        ? "FI (financial intermediary)"
        : `Category ${es}`
      : TO_BE_CONFIRMED,
  });
  projText("climate_alignment", "Climate alignment");
  projText("risks", "Key risks");
  put({
    key: "project.feasibility_done",
    label: "Feasibility study",
    group: "project",
    value: !!p.feasibility_done,
    display: p.feasibility_done ? "Complete" : "Not yet complete",
  });
  put({
    key: "project.land_secured",
    label: "Land and permits",
    group: "project",
    value: !!p.land_secured,
    display: p.land_secured ? "Secured" : "Not yet secured",
  });
  const version = Number(p.version ?? 1);
  put({
    key: "project.version",
    label: "Project record version",
    group: "project",
    value: version,
    display: String(version),
  });
  const approval = String(p.approval_status ?? "draft");
  put({
    key: "project.approval_status",
    label: "Approval status",
    group: "project",
    value: approval,
    display: APPROVAL_LABEL[approval] ?? approval,
  });

  // Headline indicators — public rows only, since these reach investors.
  const rows = ((kpis ?? []) as KpiRow[]).filter(
    (r) => r.latest_value != null && Number.isFinite(Number(r.latest_value)),
  );
  const used = new Set<string>();
  for (const h of HEADLINE_KPIS) {
    if (Object.keys(items).filter((k) => k.startsWith("kpi.")).length >= 10) break;
    const row =
      h.codes
        .map((cd) => rows.find((r) => r.kpi_code === cd && !used.has(r.kpi_code)))
        .find(Boolean) ??
      rows.find(
        (r) =>
          !used.has(r.kpi_code) && h.label.test(r.label) && !(h.exclude && h.exclude.test(r.label)),
      );
    if (!row) continue;
    used.add(row.kpi_code);
    const v = Number(row.latest_value);
    put({
      key: `kpi.${h.key}`,
      label: row.label,
      group: "country",
      value: v,
      display: formatKpi(v, row.unit),
      unit: row.unit,
      period: row.latest_period,
      source_url: row.source_url,
    });
  }

  // Readiness — pass/fail only. The compliance checks say whether a record
  // exists, never what it contains.
  const checks = readinessChecks({
    sector: p.sector as string | null,
    structure: p.structure as string | null,
    capex_usd: p.capex_usd as number | null,
    summary: p.summary as string | null,
    revenue_model: p.revenue_model as string | null,
    sponsor: p.sponsor as string | null,
    bo_disclosed: p.bo_disclosed as boolean | null,
    aml_cleared: p.aml_cleared as boolean | null,
    es_category: es,
    climate_alignment: p.climate_alignment as string | null,
    risks: p.risks as string | null,
    feasibility_done: p.feasibility_done as boolean | null,
    land_secured: p.land_secured as boolean | null,
  });
  for (const ch of checks) {
    put({
      key: `readiness.${ch.key}`,
      label: ch.label,
      group: "readiness",
      value: ch.ok,
      display: ch.ok ? "Met" : "Not yet met",
      standard: ch.standard,
    });
  }
  const passed = checks.filter((ch) => ch.ok).length;
  put({
    key: "readiness.score",
    label: "Readiness checks met",
    group: "readiness",
    value: passed,
    display: `${passed} of ${checks.length}`,
  });

  return {
    gathered_at: new Date().toISOString(),
    country_code: code,
    country_name: countryName,
    project_id: projectId,
    project_version: version,
    project_title: text(p.title as string) ?? "Untitled project",
    items,
  };
}

// ------------------------------------------------------------------ helpers for the generator

export function factFigure(facts: PackageFacts, key: string): PackageFigure | null {
  const f = facts.items[key];
  if (!f || f.value == null || f.display === TO_BE_CONFIRMED) return null;
  return {
    key,
    label: f.label,
    display: f.display,
    period: f.period ?? null,
    source_url: f.source_url ?? null,
  };
}

export function display(facts: PackageFacts, key: string): string {
  return facts.items[key]?.display ?? TO_BE_CONFIRMED;
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "—";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Key terms, straight from the facts. Shared by the teaser and memorandum. */
export function keyTerms(facts: PackageFacts): Array<{ label: string; value: string }> {
  return [
    ["Country", "country.name"],
    ["Sector", "project.sector"],
    ["Structure", "project.structure"],
    ["Stage", "project.stage"],
    ["Capital cost", "project.capex_usd"],
    ["Sponsor", "project.sponsor"],
    ["IFC E&S category", "project.es_category"],
    ["Feasibility study", "project.feasibility_done"],
    ["Land and permits", "project.land_secured"],
  ].map(([label, key]) => ({ label, value: display(facts, key) }));
}

// ------------------------------------------------------------------ data room (deterministic)

type Item = DataRoomContent["folders"][number]["items"][number];

export function buildDataRoom(facts: PackageFacts, preparedOn: string): DataRoomContent {
  const v = (k: string) => facts.items[k]?.value;
  const ok = (k: string) => v(k) === true;
  const es = (v("project.es_category") as string | null) ?? null;
  const highImpact = es === "A" || es === "B";
  const structure = String(v("project.structure") ?? "");
  const isPpp = /ppp|concession|public[- ]private|bot\b|build[- ]operate|dbfo/i.test(structure);
  const sponsor = v("project.sponsor") as string | null;
  const capex = display(facts, "project.capex_usd");

  const status = (cond: boolean): DataRoomStatus => (cond ? "available" : "to_provide");
  const RESTRICTED_NOTE =
    "Restricted — shared under NDA on request. Contents are never reproduced in this index.";

  const folder = (number: string, title: string, list: Array<Omit<Item, "ref">>) => ({
    number,
    title,
    items: list.map((it, i) => ({ ...it, ref: `${number}.${i + 1}` })),
  });

  const esItems: Array<Omit<Item, "ref">> = [
    {
      name: "Environmental and social categorisation",
      standard: "IFC Performance Standard 1",
      required: true,
      status: status(!!es),
      note: es
        ? `Recorded as ${display(facts, "project.es_category")}.`
        : "Category not yet assigned.",
    },
  ];
  if (es === "FI") {
    esItems.push({
      name: "Environmental and Social Management System (ESMS) of the intermediary",
      standard: "IFC Performance Standard 1 (FI)",
      required: true,
      status: "to_provide",
      note: "Financial-intermediary projects are assessed through the intermediary's ESMS rather than a project ESIA.",
    });
  } else {
    esItems.push(
      {
        name: "Environmental and Social Impact Assessment (ESIA)",
        standard: "IFC Performance Standard 1",
        required: highImpact,
        status: "to_provide",
        note: highImpact
          ? `Required for Category ${es} projects.`
          : es === "C"
            ? "Category C: minimal adverse impact; a full ESIA is not normally required."
            : "Requirement depends on the category, not yet assigned.",
      },
      {
        name: "Environmental and Social Management Plan (ESMP)",
        standard: "IFC Performance Standard 1",
        required: highImpact,
        status: "to_provide",
        note: highImpact
          ? "Sets out the mitigation commitments from the ESIA."
          : "Proportionate to the category.",
      },
      {
        name: "Stakeholder engagement plan and grievance mechanism",
        standard: "IFC Performance Standard 1",
        required: highImpact,
        status: "to_provide",
        note: highImpact
          ? "Informed consultation and participation is expected for this category."
          : "Proportionate to the category.",
      },
      {
        name: "Resettlement or land acquisition framework",
        standard: "IFC Performance Standard 5",
        required: false,
        status: "to_provide",
        note: "Required only if the project involves physical or economic displacement.",
      },
    );
  }
  esItems.push({
    name: "Climate alignment statement",
    standard: "ISSB IFRS S2 / EU Taxonomy",
    required: true,
    status: status(ok("readiness.climate")),
    note: ok("readiness.climate") ? "Stated in the project record." : "Not yet stated.",
  });

  return {
    kind: "data_room",
    project_title: facts.project_title,
    country_name: facts.country_name,
    prepared_on: preparedOn,
    warnings: [],
    intro: `The documents a prospective investor can expect to review for this project, with the standard that calls for each. Status is taken from project record version ${facts.project_version}. Available: on file and can be released to the data room. To provide: expected before or during due diligence. Restricted: shared under a non-disclosure agreement on request.`,
    folders: [
      folder("1", "Corporate and legal", [
        {
          name: "Constitutional documents of the sponsor and project company",
          standard: "OC4IDS (parties)",
          required: true,
          status: "to_provide",
          note: sponsor ? `Sponsor: ${sponsor}.` : "Sponsor not yet identified.",
        },
        {
          name: "Project mandate: Cabinet decision or enabling legislation",
          standard: "World Bank PPP Framework",
          required: true,
          status: "to_provide",
          note: "Evidence that the project is authorised to proceed to market.",
        },
        {
          name: isPpp
            ? "Draft concession or PPP agreement"
            : "Draft principal project agreement or term sheet",
          standard: "World Bank PPP Framework",
          required: isPpp,
          status: "to_provide",
          note: isPpp
            ? "Risk allocation, payment mechanism and termination provisions."
            : "Required once the transaction structure is fixed.",
        },
        {
          name: "Legal opinion on structure and applicable law",
          standard: "World Bank PPP Framework",
          required: true,
          status: "to_provide",
          note: "Typically commissioned during structuring.",
        },
      ]),
      folder("2", "Technical and feasibility", [
        {
          name: "Project summary: scope, sector, structure and capital cost",
          standard: "OC4IDS (project scope and budget)",
          required: true,
          status: status(ok("readiness.profile")),
          note: ok("readiness.profile")
            ? "Held in the project record."
            : "Incomplete in the project record.",
        },
        {
          name: "Feasibility study (technical, financial and economic)",
          standard: "GI Hub project preparation",
          required: true,
          status: status(ok("project.feasibility_done")),
          note: ok("project.feasibility_done") ? "Recorded as complete." : "Not yet complete.",
        },
        {
          name: "Capital cost estimate and implementation schedule",
          standard: "OC4IDS (budget and period)",
          required: true,
          status: status(ok("project.feasibility_done")),
          note: ok("project.feasibility_done")
            ? "Within the feasibility study."
            : capex !== TO_BE_CONFIRMED
              ? `Headline capital cost of ${capex} recorded; breakdown to provide.`
              : "Capital cost not yet recorded.",
        },
        {
          name: "Options analysis or pre-feasibility report",
          standard: "GI Hub project preparation",
          required: false,
          status: "to_provide",
          note: "Useful context on the alternatives considered.",
        },
      ]),
      folder("3", "Environmental and social", esItems),
      folder("4", "Commercial and financial", [
        {
          name: "Revenue model and payment mechanism",
          standard: "World Bank PPP Framework",
          required: true,
          status: status(ok("readiness.revenue")),
          note: ok("readiness.revenue") ? "Described in the project record." : "Not yet described.",
        },
        {
          name: "Market and demand study",
          standard: "GI Hub project preparation",
          required: true,
          status: status(ok("project.feasibility_done")),
          note: ok("project.feasibility_done")
            ? "Within the feasibility study."
            : "Normally part of the feasibility study.",
        },
        {
          name: "Financial model (unlocked)",
          standard: "World Bank PPP Framework",
          required: true,
          status: "to_provide",
          note: "Assumptions, sources and uses, and cash-flow waterfall.",
        },
        {
          name: "Risk register and allocation matrix",
          standard: "GI Hub project preparation / World Bank PPP Framework",
          required: true,
          status: status(ok("readiness.risks")),
          note: ok("readiness.risks")
            ? "Key risks documented; allocation to confirm in the agreement."
            : "Not yet documented.",
        },
        {
          name: "Sponsor identification",
          standard: "OC4IDS (parties)",
          required: true,
          status: status(ok("readiness.sponsor")),
          note: sponsor ? `${sponsor}.` : "Not yet identified.",
        },
        {
          name: "Sponsor financial statements (last three years)",
          standard: "World Bank PPP Framework",
          required: true,
          status: "to_provide",
          note: "Audited where available.",
        },
      ]),
      folder("5", "Land and permits", [
        {
          name: "Land title, lease or right of use",
          standard: "World Bank PPP Framework",
          required: true,
          status: status(ok("project.land_secured")),
          note: ok("project.land_secured") ? "Recorded as secured." : "Not yet secured.",
        },
        {
          name: "Principal permits and consents (planning, environmental licence)",
          standard: "World Bank PPP Framework",
          required: true,
          status: status(ok("project.land_secured")),
          note: ok("project.land_secured") ? "Recorded as secured." : "Not yet secured.",
        },
        {
          name: "Site plan and survey",
          standard: "OC4IDS (location)",
          required: true,
          status: "to_provide",
          note: "Boundaries, access and utilities.",
        },
      ]),
      folder("6", "Compliance", [
        {
          name: "Beneficial-ownership declaration",
          standard: "FATF Recommendation 24",
          required: true,
          status: "restricted",
          note: RESTRICTED_NOTE,
        },
        {
          name: "AML / CFT clearance letter",
          standard: "FATF Recommendation 10",
          required: true,
          status: "restricted",
          note: RESTRICTED_NOTE,
        },
        {
          name: "Project disclosure record (OC4IDS)",
          standard: "OC4IDS",
          required: false,
          status: status(ok("readiness.profile")),
          note: "Generated from the project record in the Open Contracting for Infrastructure Data Standard.",
        },
      ]),
    ],
  };
}
