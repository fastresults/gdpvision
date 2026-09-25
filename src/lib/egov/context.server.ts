// @domain egov
// @tables countries,country_kpis,onboarding_summaries,ministries,ministry_profiles,ministry_sectors,sectors,sector_dossiers,persona_segments,personas,commitments,mandate_compacts,compact_pillars,compact_pledges,investment_projects,memory_objects,country_sources
// @ui src/routes/_authenticated/admin/countries.$code.egov_.$prdId.tsx
//
// Context packs: the lines a PRD section may be written from. Server-only.
//
// Each stage gets its own pack, read with the caller's client so row-level
// security decides what the pack can see. Every line names its source row,
// so the provenance rail can show it and the citation table can store it.
// The pack's hash is stored with the section; when the pack changes, the
// section is out of date.
//
// The repository index (AGENTS.md and the chamber map) is bundled at build
// time, so the architecture section describes the platform as deployed.

import agentsIndex from "../../../AGENTS.md?raw";
import chambersMap from "../../../docs/map/chambers.md?raw";

import { db, type AnyClient } from "@/lib/syndication/db";

import { API_SCOPES, API_SCOPE_LABEL } from "./api-keys.functions";
import { brandPayload } from "./api.server";
import { brandContextLines, buildBrandTokens, type BrandTokens } from "./brand";
import type { ContextLine, PrdScope } from "./db";
import type { EgovStage } from "./stages";

export interface ContextPack {
  stage: EgovStage;
  lines: ContextLine[];
  hash: string;
  /** Lines the country's corpus could not supply; the section says so. */
  gaps: string[];
}

const LIMIT = {
  kpis: 24,
  ministries: 30,
  sectors: 16,
  segments: 12,
  personas: 12,
  commitments: 30,
  pledges: 30,
  projects: 12,
  memory: 24,
  sources: 12,
};

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const clip = (s: unknown, n = 280) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

function line(
  key: string,
  text: string,
  kind: ContextLine["source"]["kind"],
  ref: string,
  label: string,
): ContextLine {
  return { key, text, source: { kind, ref, label } };
}

const nf = (v: number) =>
  v.toLocaleString("en-GB", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 });

function kpiDisplay(value: number, unit: string | null): string {
  const u = (unit ?? "").toLowerCase();
  if (u.includes("%") || u.includes("percent")) return `${nf(value)}%`;
  if (u.includes("usd") || u.includes("us$")) {
    const a = Math.abs(value);
    if (a >= 1e9) return `US$${(value / 1e9).toFixed(2)} billion`;
    if (a >= 1e6) return `US$${(value / 1e6).toFixed(1)} million`;
    return `US$${nf(value)}`;
  }
  return unit ? `${nf(value)} ${unit}` : nf(value);
}

// ------------------------------------------------------------------ readers

type Reader = (sb: AnyClient, code: string) => Promise<ContextLine[]>;

const readCountry: Reader = async (sb, code) => {
  const { data } = await db(sb)
    .from("countries")
    .select(
      "code,name,currency,gdp_current_usd,gdp_year,is_caricom,is_oecs,is_cbi_state,fiscal_year_start_month",
    )
    .eq("code", code)
    .maybeSingle();
  if (!data) return [];
  const c = data as Record<string, unknown>;
  const out: ContextLine[] = [
    line(
      "country.name",
      `Country: ${c.name}`,
      "corpus_row",
      `countries:${code}`,
      "Country profile",
    ),
    line(
      "country.currency",
      `Currency: ${c.currency}`,
      "corpus_row",
      `countries:${code}`,
      "Country profile",
    ),
  ];
  if (typeof c.gdp_current_usd === "number")
    out.push(
      line(
        "country.gdp",
        `Nominal GDP: ${kpiDisplay(c.gdp_current_usd, "USD")}${c.gdp_year ? ` (${c.gdp_year})` : ""}`,
        "corpus_row",
        `countries:${code}`,
        "Country profile",
      ),
    );
  const groups = [
    c.is_caricom && "CARICOM",
    c.is_oecs && "OECS",
    c.is_cbi_state && "citizenship-by-investment state",
  ].filter(Boolean);
  if (groups.length)
    out.push(
      line(
        "country.groups",
        `Memberships: ${groups.join(", ")}`,
        "corpus_row",
        `countries:${code}`,
        "Country profile",
      ),
    );
  return out;
};

const readKpis: Reader = async (sb, code) => {
  const { data } = await db(sb)
    .from("country_kpis")
    .select("id,kpi_code,label,unit,latest_value,latest_period,source_url,category")
    .eq("country_code", code)
    .not("latest_value", "is", null)
    .order("category", { ascending: true })
    .limit(LIMIT.kpis);
  return ((data ?? []) as Array<Record<string, unknown>>).map((k) =>
    line(
      `kpi.${k.kpi_code}`,
      `${k.label}: ${kpiDisplay(Number(k.latest_value), k.unit as string | null)}${k.latest_period ? ` (${k.latest_period})` : ""}`,
      "corpus_row",
      `country_kpis:${k.id}`,
      String(k.label),
    ),
  );
};

const readSummaries: Reader = async (sb, code) => {
  const { data } = await db(sb)
    .from("onboarding_summaries")
    .select("stage,summary_md")
    .eq("country_code", code)
    .limit(12);
  return ((data ?? []) as Array<{ stage: string; summary_md: string }>).map((s) =>
    line(
      `summary.${s.stage}`,
      `${s.stage}: ${clip(s.summary_md, 600)}`,
      "corpus_row",
      `onboarding_summaries:${code}/${s.stage}`,
      `Onboarding summary — ${s.stage}`,
    ),
  );
};

const readMinistries: Reader = async (sb, code) => {
  const c = db(sb);
  const [{ data: ministries }, { data: profiles }, { data: sectors }] = await Promise.all([
    c
      .from("ministries")
      .select("id,name,slug")
      .eq("country_code", code)
      .order("sort_order")
      .limit(LIMIT.ministries),
    c
      .from("ministry_profiles")
      .select("id,ministry_slug,minister,mandate,programmes")
      .eq("country_code", code)
      .limit(LIMIT.ministries),
    c.from("sectors").select("code,label").limit(60),
  ]);
  const ms = (ministries ?? []) as Array<{ id: string; name: string; slug: string }>;
  const ids = ms.map((m) => m.id);
  const { data: weights } = ids.length
    ? await c
        .from("ministry_sectors")
        .select("ministry_id,sector_code,weight")
        .in("ministry_id", ids)
    : { data: [] as unknown[] };
  const sectorLabel = new Map(
    ((sectors ?? []) as Array<{ code: string; label: string }>).map((s) => [s.code, s.label]),
  );
  const bySlug = new Map(
    ((profiles ?? []) as Array<Record<string, unknown>>).map((p) => [String(p.ministry_slug), p]),
  );
  const wByMin = new Map<string, string[]>();
  for (const w of (weights ?? []) as Array<{
    ministry_id: string;
    sector_code: string;
    weight: number;
  }>) {
    if (w.weight <= 0) continue;
    const l = wByMin.get(w.ministry_id) ?? [];
    l.push(sectorLabel.get(w.sector_code) ?? w.sector_code);
    wByMin.set(w.ministry_id, l);
  }
  return ms.map((m) => {
    const p = bySlug.get(m.slug);
    const programmes = Array.isArray(p?.programmes)
      ? (p!.programmes as Array<Record<string, unknown>>)
          .map((x) => (typeof x === "string" ? x : String(x.title ?? x.name ?? "")))
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const parts = [
      `Ministry: ${m.name}`,
      p?.minister ? `minister ${clip(p.minister, 80)}` : null,
      p?.mandate ? `mandate: ${clip(p.mandate, 220)}` : null,
      wByMin.get(m.id)?.length ? `sectors: ${wByMin.get(m.id)!.slice(0, 5).join(", ")}` : null,
      programmes.length ? `programmes: ${programmes.join("; ")}` : null,
    ].filter(Boolean);
    return line(
      `ministry.${m.slug}`,
      parts.join(" — "),
      "corpus_row",
      p ? `ministry_profiles:${p.id}` : `ministries:${m.id}`,
      m.name,
    );
  });
};

const readSectors: Reader = async (sb, code) => {
  const { data } = await db(sb)
    .from("sector_dossiers")
    .select("id,sector_code,kind,payload,confidence")
    .eq("country_code", code)
    .limit(LIMIT.sectors);
  return ((data ?? []) as Array<Record<string, unknown>>).map((d) => {
    const p = (d.payload ?? {}) as Record<string, unknown>;
    const text = clip(p.summary ?? p.overview ?? p.headline ?? JSON.stringify(p), 320);
    return line(
      `sector.${d.sector_code}.${d.kind}`,
      `Sector ${d.sector_code} (${d.kind}, confidence ${d.confidence}): ${text}`,
      "corpus_row",
      `sector_dossiers:${d.id}`,
      `Sector dossier — ${d.sector_code}`,
    );
  });
};

const readPersonas: Reader = async (sb, code) => {
  const c = db(sb);
  const [{ data: segments }, { data: personas }] = await Promise.all([
    c
      .from("persona_segments")
      .select("id,label,prompt,size")
      .eq("country_code", code)
      .limit(LIMIT.segments),
    c
      .from("personas")
      .select("id,name,archetype,summary")
      .eq("country_code", code)
      .limit(LIMIT.personas),
  ]);
  return [
    ...((segments ?? []) as Array<Record<string, unknown>>).map((s) =>
      line(
        `segment.${s.id}`,
        `Segment "${s.label}" (${s.size} personas): ${clip(s.prompt, 240)}`,
        "corpus_row",
        `persona_segments:${s.id}`,
        `Segment — ${s.label}`,
      ),
    ),
    ...((personas ?? []) as Array<Record<string, unknown>>).map((p) =>
      line(
        `persona.${p.id}`,
        `Persona ${p.name}${p.archetype ? ` (${p.archetype})` : ""}: ${clip(p.summary, 240)}`,
        "corpus_row",
        `personas:${p.id}`,
        `Persona — ${p.name}`,
      ),
    ),
  ];
};

const readCommitments: Reader = async (sb, code) => {
  const c = db(sb);
  const [{ data: commitments }, { data: compacts }] = await Promise.all([
    c
      .from("commitments")
      .select("id,title,status,due_at,success_metric")
      .eq("country_code", code)
      .order("created_at", { ascending: false })
      .limit(LIMIT.commitments),
    c
      .from("mandate_compacts")
      .select("id,title,status,summary,election_cycle,pm_name")
      .eq("country_code", code)
      .limit(3),
  ]);
  const out: ContextLine[] = ((commitments ?? []) as Array<Record<string, unknown>>).map((k) =>
    line(
      `commitment.${k.id}`,
      `Cabinet commitment "${k.title}" — ${k.status}${k.due_at ? `, due ${String(k.due_at).slice(0, 10)}` : ""}${k.success_metric ? `; metric: ${clip(k.success_metric, 120)}` : ""}`,
      "corpus_row",
      `commitments:${k.id}`,
      `Commitment — ${clip(k.title, 60)}`,
    ),
  );
  const cps = (compacts ?? []) as Array<Record<string, unknown>>;
  for (const cp of cps) {
    out.push(
      line(
        `compact.${cp.id}`,
        `Mandate Compact "${cp.title ?? cp.election_cycle}" (${cp.status}${cp.pm_name ? `, ${cp.pm_name}` : ""}): ${clip(cp.summary, 300)}`,
        "corpus_row",
        `mandate_compacts:${cp.id}`,
        "Mandate Compact",
      ),
    );
    const [{ data: pillars }, { data: pledges }] = await Promise.all([
      c
        .from("compact_pillars")
        .select("id,title,narrative")
        .eq("compact_id", cp.id)
        .order("sort_order")
        .limit(8),
      c
        .from("compact_pledges")
        .select("id,title,pledge_type,target_value,unit")
        .eq("compact_id", cp.id)
        .order("sort_order")
        .limit(LIMIT.pledges),
    ]);
    for (const p of (pillars ?? []) as Array<Record<string, unknown>>)
      out.push(
        line(
          `pillar.${p.id}`,
          `Compact pillar "${p.title}": ${clip(p.narrative, 200)}`,
          "corpus_row",
          `compact_pillars:${p.id}`,
          `Pillar — ${clip(p.title, 60)}`,
        ),
      );
    for (const p of (pledges ?? []) as Array<Record<string, unknown>>)
      out.push(
        line(
          `pledge.${p.id}`,
          `Pledge "${p.title}"${p.pledge_type ? ` (${p.pledge_type})` : ""}${p.target_value != null ? `, target ${p.target_value}${p.unit ? ` ${p.unit}` : ""}` : ""}`,
          "corpus_row",
          `compact_pledges:${p.id}`,
          `Pledge — ${clip(p.title, 60)}`,
        ),
      );
  }
  return out;
};

const readStandardsGaps: Reader = async (sb, code) => {
  try {
    const { computeCountryAudit } = await import("@/lib/standards/audit-data.server");
    const audit = await computeCountryAudit(sb as never, code);
    const gaps = audit.rows.filter(
      (r) => r.status === "missing" || r.status === "partial" || r.status === "stale",
    );
    const out = gaps
      .slice(0, 30)
      .map((r) =>
        line(
          `gap.${r.id}`,
          `Standards gap (${r.standardCode}, ${r.impact} impact): ${r.label} — ${r.status}${r.plan ? "; a collection plan exists" : ""}`,
          "corpus_row",
          `standard_requirements:${r.id}`,
          `${r.standardCode} — ${clip(r.label, 60)}`,
        ),
      );
    out.unshift(
      line(
        "gap.summary",
        `Standards audit: ${audit.summary.counts.collected ?? 0} of ${audit.summary.total} requirements collected; coverage ${audit.summary.coveragePct}%`,
        "corpus_row",
        `standards_audit:${code}`,
        "Standards audit summary",
      ),
    );
    return out;
  } catch {
    return [];
  }
};

const readProjects: Reader = async (sb, code) => {
  const { data } = await db(sb)
    .from("investment_projects")
    .select("id,title,sector,stage,summary")
    .eq("country_code", code)
    .eq("approval_status", "approved")
    .limit(LIMIT.projects);
  return ((data ?? []) as Array<Record<string, unknown>>).map((p) =>
    line(
      `project.${p.id}`,
      `Approved investment project "${p.title}"${p.sector ? ` (${p.sector}, ${p.stage})` : ""}: ${clip(p.summary, 200)}`,
      "corpus_row",
      `investment_projects:${p.id}`,
      `Project — ${clip(p.title, 60)}`,
    ),
  );
};

const readMemory: Reader = async (sb, code) => {
  const { data } = await db(sb)
    .from("memory_objects")
    .select("id,kind,title,payload,verified")
    .eq("scope_key", code)
    .in("kind", ["fact", "risk", "audience", "position", "outlet"])
    .order("weight", { ascending: false })
    .limit(LIMIT.memory);
  return ((data ?? []) as Array<Record<string, unknown>>).map((m) => {
    const p = (m.payload ?? {}) as Record<string, unknown>;
    return line(
      `memory.${m.id}`,
      `${m.kind}${m.verified ? " (verified)" : ""}: ${m.title} — ${clip(p.summary ?? p.text ?? p.body ?? "", 200)}`,
      "corpus_row",
      `memory_objects:${m.id}`,
      `Second brain — ${clip(m.title, 60)}`,
    );
  });
};

const readSources: Reader = async (sb, code) => {
  const { data } = await db(sb)
    .from("country_sources")
    .select("id,title,org,url,kind,summary")
    .eq("country_code", code)
    .eq("active", true)
    .order("quality_score", { ascending: false })
    .limit(LIMIT.sources);
  return ((data ?? []) as Array<Record<string, unknown>>).map((s) =>
    line(
      `source.${s.id}`,
      `Source ${s.org} — ${s.title} (${s.kind}): ${clip(s.summary, 160)}`,
      "research_url",
      String(s.url),
      `${s.org} — ${clip(s.title, 60)}`,
    ),
  );
};

function repoLines(): ContextLine[] {
  const section = (md: string, from: RegExp, max: number) => {
    const i = md.search(from);
    return clip(i === -1 ? md : md.slice(i), max);
  };
  return [
    line(
      "repo.stack",
      section(agentsIndex, /^Stack:/m, 240),
      "repo_file",
      "AGENTS.md",
      "GDPVision repository index",
    ),
    line(
      "repo.chambers",
      section(agentsIndex, /## 3\. Chambers/m, 2400),
      "repo_file",
      "AGENTS.md",
      "GDPVision chambers",
    ),
    line(
      "repo.corpus",
      section(agentsIndex, /## 5\. Corpus/m, 900),
      "repo_file",
      "AGENTS.md",
      "GDPVision corpus",
    ),
    line(
      "repo.chamber_map",
      clip(chambersMap, 2400),
      "repo_file",
      "docs/map/chambers.md",
      "GDPVision chamber map",
    ),
    line(
      "repo.interface",
      "GDPVision exposes to a country platform, read-only and only once approved: country indicators with citations; Mandate Compact and Cabinet commitments with status; procurement records in OC4IDS form; approved investor teasers; ministry profiles and mandates. Never exposed: drafts, compliance records, beneficial owners, persona data, narrative signals.",
      "repo_file",
      "prds/PRD-digital-government-studio.md#8",
      "GDPVision interface contract",
    ),
  ];
}

/** The flag as logo and favicon, and the photography plan — the same payload the API serves. */
function marksAndImageryLines(code: string, t: BrandTokens): ContextLine[] {
  const b = brandPayload(code, t);
  const src = (k: string, text: string) =>
    line(k, text, "user", "brand", "Brand marks and imagery");
  return [
    src(
      "marks.logo",
      `Logo: ${b.flag.usage.logo}${b.flag.svg ? ` Vector flag: ${b.flag.svg}` : ""}`,
    ),
    src(
      "marks.favicon",
      `Favicon files: ${b.flag.usage.favicon.join(", ")}. Touch icon: ${b.flag.usage.touch_icon}`,
    ),
    src("marks.rule", b.flag.usage.rule),
    src("imagery.style", `Imagery style: ${b.imagery.style}`),
    ...b.imagery.rules.map((r, i) => src(`imagery.rule.${i + 1}`, `Imagery rule: ${r}`)),
    ...b.imagery.required_sets.map((x) =>
      src(`imagery.set.${x.key}`, `Required image set "${x.key}" — ${x.purpose}: ${x.count}`),
    ),
  ];
}

/** The GDPVision → platform API, as the architecture section must describe it. */
function apiContractLines(code: string): ContextLine[] {
  const base = `https://gdpvision.com/api/public/v1`;
  const src = (k: string, text: string) =>
    line(k, text, "repo_file", "src/lib/egov/api.server.ts", "GDPVision API contract");
  return [
    src(
      "api.auth",
      `Authentication: every request carries "Authorization: Bearer gdpv_${code.toLowerCase()}_…", a key issued from the PRD's Platform connection panel; keys are scoped to resources, expire, and can be revoked.`,
    ),
    src(
      "api.handshake",
      `Handshake: GET ${base}/handshake returns the country, the key's scopes, the approved PRD version, the brand payload (tokens, flag, favicon, imagery rules) and the URL of every resource the key may read.`,
    ),
    ...API_SCOPES.map((s) =>
      src(
        `api.resource.${s}`,
        `Resource: GET ${base}/countries/${code}/${s} — ${API_SCOPE_LABEL[s]}.`,
      ),
    ),
    src(
      "api.envelope",
      "Envelope: { country, resource, version, generated_at, count, next_since, data }; kpis, commitments, sectors, projects, brain and sources accept ?since=<next_since> for incremental sync.",
    ),
    src(
      "api.sync",
      "Sync: poll hourly on the server side, store the last good copy, and serve it when GDPVision is unreachable; responses may be cached for 60 seconds.",
    ),
    src(
      "api.env",
      `Environment variables on the platform: GDPVISION_BASE_URL=${base}, GDPVISION_COUNTRY=${code}, GDPVISION_API_KEY=<the key>; the key never reaches the browser.`,
    ),
    src(
      "api.boundary",
      "Never served: PRD drafts and context packs, compliance records, beneficial owners, persona data, narrative signals, cabinet minutes, unapproved projects or investor materials, and any row not marked public.",
    ),
  ];
}

function scopeLines(scope: PrdScope): ContextLine[] {
  return [
    line(
      "scope.platform",
      `Platform name: ${scope.platform_name || "To be confirmed"}`,
      "user",
      "scope",
      "PRD scope",
    ),
    line(
      "scope.audiences",
      `Audiences in scope: ${scope.audiences.join(", ") || "all"}`,
      "user",
      "scope",
      "PRD scope",
    ),
    line(
      "scope.priorities",
      `Priorities: ${scope.priorities.join(", ") || "not stated"}`,
      "user",
      "scope",
      "PRD scope",
    ),
    line(
      "scope.hosting",
      `Hosting preference: ${scope.hosting || "not stated"}`,
      "user",
      "scope",
      "PRD scope",
    ),
    ...(scope.notes
      ? [
          line(
            "scope.notes",
            `Notes from the author: ${clip(scope.notes, 600)}`,
            "user",
            "scope",
            "PRD scope",
          ),
        ]
      : []),
  ];
}

// ------------------------------------------------------------------ packs

const READERS: Record<EgovStage, Reader[]> = {
  country_context: [readCountry, readSummaries, readKpis, readSources],
  audiences: [readCountry, readPersonas, readMemory],
  service_catalogue: [readCountry, readMinistries, readSectors, readPersonas],
  governance_layer: [readCountry, readCommitments, readStandardsGaps],
  outward_layer: [readCountry, readSectors, readProjects, readMemory],
  identity_payments_interop: [readCountry, readMinistries, readSources],
  brand_system: [readCountry],
  architecture: [readCountry, readMinistries],
  roadmap_proforma: [readCountry, readMinistries, readKpis],
  acceptance_kpis: [readCountry, readKpis, readCommitments],
};

/** What each stage needs and would say is missing if the corpus is empty. */
const EXPECTS: Partial<Record<EgovStage, Array<{ prefix: string; label: string }>>> = {
  country_context: [{ prefix: "kpi.", label: "headline indicators" }],
  audiences: [{ prefix: "segment.", label: "persona segments" }],
  service_catalogue: [{ prefix: "ministry.", label: "ministry profiles" }],
  governance_layer: [
    { prefix: "commitment.", label: "Cabinet commitments" },
    { prefix: "compact.", label: "a Mandate Compact" },
  ],
  outward_layer: [{ prefix: "sector.", label: "sector dossiers" }],
  acceptance_kpis: [{ prefix: "kpi.", label: "headline indicators" }],
};

export async function buildContextPack(
  sb: AnyClient,
  code: string,
  stage: EgovStage,
  scope: PrdScope,
  brand?: BrandTokens,
): Promise<ContextPack> {
  const results = await Promise.all(
    READERS[stage].map((r) => r(sb, code).catch(() => [] as ContextLine[])),
  );
  const lines: ContextLine[] = [...scopeLines(scope), ...results.flat()];
  if (stage === "brand_system") {
    const t = brand ?? buildBrandTokens(code);
    lines.push(
      ...brandContextLines(t).map((text, i) =>
        line(`brand.${i}`, text, "user", "brand", "Brand tokens"),
      ),
    );
  }
  if (stage === "architecture") lines.push(...repoLines());

  const gaps = (EXPECTS[stage] ?? [])
    .filter((e) => !lines.some((l) => l.key.startsWith(e.prefix)))
    .map((e) => e.label);

  // Hash the corpus lines only, so a scope edit does not mark every section stale.
  const hashable = lines.filter((l) => l.source.kind !== "user").map((l) => `${l.key}\t${l.text}`);
  const hash = await sha256Hex(hashable.join("\n"));
  return { stage, lines, hash, gaps };
}
