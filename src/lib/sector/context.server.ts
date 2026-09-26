// @domain sector
// @tables sectors,country_sectors,sector_dossiers,sector_dossier_briefs,sector_edges,memory_objects,investment_projects,fdi_threats,scenarios,commitments,ministries,ministry_sectors
// @ui src/routes/_authenticated/admin/countries.$code.sector_.$planId.tsx
//
// Context packs for the Sector Studio: the lines a plan section (or the
// Scout's shortlist) may be written from. Server-only.
//
// Country-wide lines come from the Digital Government Studio's corpus readers
// (src/lib/egov/context.server.ts); the sector readers below narrow to one
// sector. Every pack also carries the method (docs/prd/sector-studio-framework.md,
// bundled at build time), so plans are drafted to the same framework. Each
// line names its source row; the pack's hash marks a section out of date when
// the corpus behind it changes.

import method from "../../../docs/prd/sector-studio-framework.md?raw";

import {
  CORPUS_READERS,
  clipText as clip,
  contextLine as line,
  sha256Hex,
  type Reader,
} from "@/lib/egov/context.server";
import { db, type AnyClient } from "@/lib/syndication/db";

import type { ContextLine, PlanScope } from "./db";
import type { SectorStage } from "./stages";

export interface SectorContextPack {
  stage: SectorStage;
  lines: ContextLine[];
  hash: string;
  gaps: string[];
}

type SectorReader = (sb: AnyClient, code: string, sector: string) => Promise<ContextLine[]>;

const country =
  (r: Reader): SectorReader =>
  (sb, code) =>
    r(sb, code);

// ------------------------------------------------------------------ sector readers

async function sectorLabel(sb: AnyClient, sector: string): Promise<string> {
  const { data } = await db(sb).from("sectors").select("label").eq("code", sector).maybeSingle();
  return ((data as { label?: string } | null)?.label ?? sector).trim();
}

const readSectorCore: SectorReader = async (sb, code, sector) => {
  const c = db(sb);
  const [label, { data: share }, { data: brief }, { data: dossiers }] = await Promise.all([
    sectorLabel(sb, sector),
    c
      .from("country_sectors")
      .select("share_pct,confidence_grade,source_ref")
      .eq("country_code", code)
      .eq("sector_code", sector)
      .maybeSingle(),
    c
      .from("sector_dossier_briefs")
      .select("brief,generated_at")
      .eq("country_code", code)
      .eq("sector_code", sector)
      .maybeSingle(),
    c
      .from("sector_dossiers")
      .select("id,kind,payload,confidence")
      .eq("country_code", code)
      .eq("sector_code", sector)
      .limit(6),
  ]);
  const out: ContextLine[] = [
    line("sector.name", `Sector: ${label} (${sector})`, "corpus_row", `sectors:${sector}`, label),
  ];
  const s = share as { share_pct?: number; confidence_grade?: string; source_ref?: string } | null;
  if (s?.share_pct != null)
    out.push(
      line(
        "sector.share",
        `${label} share of GDP: ${Number(s.share_pct).toFixed(1)}% (confidence grade ${s.confidence_grade ?? "C"})`,
        "corpus_row",
        `country_sectors:${code}/${sector}`,
        `${label} — share of GDP`,
      ),
    );
  const b = (brief as { brief?: Record<string, unknown> } | null)?.brief;
  if (b) {
    const ref = `sector_dossier_briefs:${code}/${sector}`;
    const lbl = `Sector brief — ${label}`;
    if (b.headline)
      out.push(
        line("brief.headline", `Brief headline: ${clip(b.headline, 240)}`, "corpus_row", ref, lbl),
      );
    if (b.executive)
      out.push(
        line("brief.executive", `Brief summary: ${clip(b.executive, 900)}`, "corpus_row", ref, lbl),
      );
    const p = (b.pyramid ?? {}) as Record<string, unknown>;
    for (const k of ["situation", "complication", "resolution"] as const)
      if (p[k])
        out.push(line(`brief.${k}`, `Brief ${k}: ${clip(p[k], 500)}`, "corpus_row", ref, lbl));
    const pillars = Array.isArray(b.pillars) ? (b.pillars as Array<Record<string, unknown>>) : [];
    pillars.slice(0, 8).forEach((pl, i) => {
      const bullets = Array.isArray(pl.bullets)
        ? (pl.bullets as unknown[]).map(String).slice(0, 4)
        : [];
      out.push(
        line(
          `brief.pillar.${i + 1}`,
          `Brief ${pl.kind ?? "pillar"} "${clip(pl.title, 80)}": ${clip(bullets.join("; "), 360)}`,
          "corpus_row",
          ref,
          lbl,
        ),
      );
    });
    if (b.outlook)
      out.push(
        line("brief.outlook", `Brief outlook: ${clip(b.outlook, 500)}`, "corpus_row", ref, lbl),
      );
  }
  for (const d of (dossiers ?? []) as Array<Record<string, unknown>>) {
    const p = (d.payload ?? {}) as Record<string, unknown>;
    out.push(
      line(
        `dossier.${d.kind}`,
        `Sector dossier (${d.kind}, confidence ${d.confidence}): ${clip(p.summary ?? p.overview ?? p.headline ?? JSON.stringify(p), 700)}`,
        "corpus_row",
        `sector_dossiers:${d.id}`,
        `Sector dossier — ${label} (${d.kind})`,
      ),
    );
  }
  return out;
};

const readSectorLinks: SectorReader = async (sb, _code, sector) => {
  const c = db(sb);
  const [{ data: edges }, { data: sectors }] = await Promise.all([
    c
      .from("sector_edges")
      .select("id,from_sector,to_sector,weight,order_rank,notes")
      .or(`from_sector.eq.${sector},to_sector.eq.${sector}`)
      .order("weight", { ascending: false })
      .limit(10),
    c.from("sectors").select("code,label"),
  ]);
  const name = new Map(
    ((sectors ?? []) as Array<{ code: string; label: string }>).map((s) => [s.code, s.label]),
  );
  return ((edges ?? []) as Array<Record<string, unknown>>).map((e) => {
    const outward = e.from_sector === sector;
    const other = String(outward ? e.to_sector : e.from_sector);
    return line(
      `link.${other}`,
      `${outward ? "Feeds" : "Fed by"} ${name.get(other) ?? other} (weight ${Number(e.weight).toFixed(2)}, order ${e.order_rank})${e.notes ? `: ${clip(e.notes, 160)}` : ""}`,
      "corpus_row",
      `sector_edges:${e.id}`,
      `Sector link — ${name.get(other) ?? other}`,
    );
  });
};

const readSectorMinistries: SectorReader = async (sb, code, sector) => {
  const c = db(sb);
  const { data: ministries } = await c
    .from("ministries")
    .select("id,slug")
    .eq("country_code", code);
  const ms = (ministries ?? []) as Array<{ id: string; slug: string }>;
  const { data: weights } = ms.length
    ? await c
        .from("ministry_sectors")
        .select("ministry_id,weight")
        .eq("sector_code", sector)
        .in(
          "ministry_id",
          ms.map((m) => m.id),
        )
    : { data: [] as unknown[] };
  const owning = new Set(
    ((weights ?? []) as Array<{ ministry_id: string; weight: number }>)
      .filter((w) => w.weight > 0)
      .map((w) => ms.find((m) => m.id === w.ministry_id)?.slug)
      .filter(Boolean) as string[],
  );
  const all = await CORPUS_READERS.ministries(sb, code);
  const mine = all.filter((l) => owning.has(l.key.replace(/^ministry\./, "")));
  // No weighting recorded: give the whole cabinet so the model can pick, and say so.
  return mine.length ? mine : all.slice(0, 20);
};

const readSectorMemory: SectorReader = async (sb, code, sector) => {
  const { data } = await db(sb)
    .from("memory_objects")
    .select("id,kind,title,payload,verified")
    .eq("scope_key", code)
    .eq("sector_code", sector)
    .order("weight", { ascending: false })
    .limit(16);
  return ((data ?? []) as Array<Record<string, unknown>>).map((m) => {
    const p = (m.payload ?? {}) as Record<string, unknown>;
    return line(
      `memory.${m.id}`,
      `${m.kind}${m.verified ? " (verified)" : ""}: ${m.title} — ${clip(p.summary ?? p.text ?? p.body ?? "", 240)}`,
      "corpus_row",
      `memory_objects:${m.id}`,
      `Second brain — ${clip(m.title, 60)}`,
    );
  });
};

const readSectorProjects: SectorReader = async (sb, code, sector) => {
  const label = (await sectorLabel(sb, sector)).toLowerCase();
  const { data } = await db(sb)
    .from("investment_projects")
    .select("id,title,sector,stage,summary,capex_usd,structure")
    .eq("country_code", code)
    .eq("approval_status", "approved")
    .limit(40);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((p) => {
      const s = String(p.sector ?? "").toLowerCase();
      return s === sector || s === label || (s && (label.includes(s) || s.includes(sector)));
    })
    .slice(0, 12)
    .map((p) =>
      line(
        `project.${p.id}`,
        `Approved investment project "${p.title}" (${p.stage}${p.structure ? `, ${p.structure}` : ""}${p.capex_usd ? `, capex US$${Number(p.capex_usd).toLocaleString("en-GB")}` : ""}): ${clip(p.summary, 220)}`,
        "corpus_row",
        `investment_projects:${p.id}`,
        `Project — ${clip(p.title, 60)}`,
      ),
    );
};

const readSectorThreats: SectorReader = async (sb, code, sector) => {
  const { data } = await db(sb)
    .from("fdi_threats")
    .select("id,name,threat_type,severity_pct,horizon_years,onset")
    .eq("country_code", code)
    .contains("target_sector_codes", [sector])
    .limit(8);
  return ((data ?? []) as Array<Record<string, unknown>>).map((t) =>
    line(
      `threat.${t.id}`,
      `Modelled threat "${t.name}" (${t.threat_type}; severity ${t.severity_pct}%, ${t.horizon_years}-year horizon, ${t.onset} onset)`,
      "corpus_row",
      `fdi_threats:${t.id}`,
      `FDI Transition Studio — ${clip(t.name, 60)}`,
    ),
  );
};

const readSectorScenarios: SectorReader = async (sb, code, sector) => {
  const { data } = await db(sb)
    .from("scenarios")
    .select("id,title,horizon_years,status,assumptions,results")
    .eq("country_code", code)
    .eq("sector_code", sector)
    .order("updated_at", { ascending: false })
    .limit(4);
  return ((data ?? []) as Array<Record<string, unknown>>).map((s) =>
    line(
      `scenario.${s.id}`,
      `Scenario "${s.title}" (${s.status}, ${s.horizon_years} years): results ${clip(JSON.stringify(s.results ?? {}), 360)}`,
      "corpus_row",
      `scenarios:${s.id}`,
      `Scenario — ${clip(s.title, 60)}`,
    ),
  );
};

const readSectorCommitments: SectorReader = async (sb, code, sector) => {
  const { data } = await db(sb)
    .from("commitments")
    .select("id,title,status,due_at,success_metric")
    .eq("country_code", code)
    .eq("sector_code", sector)
    .order("created_at", { ascending: false })
    .limit(12);
  return ((data ?? []) as Array<Record<string, unknown>>).map((k) =>
    line(
      `commitment.${k.id}`,
      `Cabinet commitment for this sector "${k.title}" — ${k.status}${k.due_at ? `, due ${String(k.due_at).slice(0, 10)}` : ""}${k.success_metric ? `; metric: ${clip(k.success_metric, 120)}` : ""}`,
      "corpus_row",
      `commitments:${k.id}`,
      `Commitment — ${clip(k.title, 60)}`,
    ),
  );
};

// ------------------------------------------------------------------ method

/** The framework file, split by "## " heading. */
function methodSections(): Map<string, string> {
  const out = new Map<string, string>();
  const parts = method.split(/^## /m);
  out.set("Thesis", clip(parts[0]?.replace(/^#.*$/m, "") ?? "", 600));
  for (const p of parts.slice(1)) {
    const nl = p.indexOf("\n");
    out.set(p.slice(0, nl).trim(), p.slice(nl + 1).trim());
  }
  return out;
}

const METHOD_FOR: Record<SectorStage, string[]> = {
  diagnostic: ["Evidence", "Seven ingredients", "Implementation plan"],
  ambition: ["Seven ingredients", "Head of Government", "Implementation plan"],
  pillars: ["Seven ingredients", "Implementation plan"],
  projects: ["Implementation plan", "Sector Council"],
  enablers: ["Evidence", "Implementation plan"],
  measurement: ["Implementation plan", "Line minister"],
  compact: ["Head of Government", "Line minister"],
  council: ["Sector Council"],
  sensitisation: ["National sensitisation"],
  roadmap: ["Head of Government", "Implementation plan"],
};

function methodLines(stage: SectorStage): ContextLine[] {
  const secs = methodSections();
  return METHOD_FOR[stage]
    .map((h) => [h, secs.get(h)] as const)
    .filter((x): x is readonly [string, string] => !!x[1])
    .map(([h, text]) =>
      line(
        `method.${h.toLowerCase().replace(/[^a-z]+/g, "_")}`,
        `Method — ${h}: ${clip(text, 2200)}`,
        "repo_file",
        "docs/prd/sector-studio-framework.md",
        `Sector Studio method — ${h}`,
      ),
    );
}

function scopeLines(scope: PlanScope): ContextLine[] {
  const s = (k: string, t: string) => line(k, t, "user", "scope", "Plan scope");
  return [
    s("scope.lead_ministry", `Lead ministry: ${scope.lead_ministry || "To be confirmed"}`),
    s("scope.horizon", `Plan horizon: ${scope.horizon_years} years`),
    ...(scope.ambition
      ? [s("scope.ambition", `Ambition stated by the author: ${clip(scope.ambition, 600)}`)]
      : []),
    ...(scope.notes ? [s("scope.notes", `Notes from the author: ${clip(scope.notes, 600)}`)] : []),
  ];
}

// ------------------------------------------------------------------ packs

const C = CORPUS_READERS;

const READERS: Record<SectorStage, SectorReader[]> = {
  diagnostic: [
    country(C.country),
    country(C.kpis),
    country(C.summaries),
    readSectorCore,
    readSectorLinks,
    readSectorMemory,
    readSectorThreats,
    country(C.sources),
  ],
  ambition: [
    country(C.country),
    country(C.kpis),
    readSectorCore,
    readSectorScenarios,
    readSectorThreats,
    readSectorProjects,
    readSectorMemory,
  ],
  pillars: [
    country(C.country),
    readSectorCore,
    readSectorMinistries,
    readSectorMemory,
    country(C.standardsGaps),
  ],
  projects: [
    country(C.country),
    readSectorMinistries,
    readSectorProjects,
    readSectorCommitments,
    country(C.commitments),
  ],
  enablers: [country(C.country), readSectorMinistries, readSectorMemory, country(C.sources)],
  measurement: [
    country(C.country),
    country(C.kpis),
    country(C.standardsGaps),
    readSectorCommitments,
  ],
  compact: [country(C.country), readSectorMinistries, country(C.commitments)],
  council: [country(C.country), readSectorMinistries, readSectorMemory],
  sensitisation: [country(C.country), country(C.personas), readSectorCore],
  roadmap: [country(C.country), readSectorMinistries, country(C.kpis), readSectorProjects],
};

const EXPECTS: Partial<Record<SectorStage, Array<{ prefix: string; label: string }>>> = {
  diagnostic: [
    { prefix: "brief.", label: "a sector brief (build the sector dossier first)" },
    { prefix: "sector.share", label: "the sector's share of GDP" },
  ],
  ambition: [{ prefix: "kpi.", label: "headline indicators" }],
  projects: [{ prefix: "ministry.", label: "ministry profiles" }],
  measurement: [{ prefix: "kpi.", label: "headline indicators" }],
  sensitisation: [{ prefix: "segment.", label: "persona segments" }],
};

export async function buildSectorPack(
  sb: AnyClient,
  code: string,
  sector: string,
  stage: SectorStage,
  scope: PlanScope,
): Promise<SectorContextPack> {
  const results = await Promise.all(
    READERS[stage].map((r) => r(sb, code, sector).catch(() => [] as ContextLine[])),
  );
  // Readers may overlap (sector core in several); keep the first line per key.
  const seen = new Set<string>();
  const corpus = results.flat().filter((l) => (seen.has(l.key) ? false : (seen.add(l.key), true)));
  const lines: ContextLine[] = [...scopeLines(scope), ...corpus, ...methodLines(stage)];

  const gaps = (EXPECTS[stage] ?? [])
    .filter((e) => !lines.some((l) => l.key.startsWith(e.prefix)))
    .map((e) => e.label);

  const hashable = lines.filter((l) => l.source.kind !== "user").map((l) => `${l.key}\t${l.text}`);
  const hash = await sha256Hex(hashable.join("\n"));
  return { stage, lines, hash, gaps };
}

// ------------------------------------------------------------------ scout

/** One pack for the Scout: the country, and a short profile of every sector. */
export async function buildScoutPack(
  sb: AnyClient,
  code: string,
): Promise<{
  lines: ContextLine[];
  hash: string;
  sectors: Array<{ code: string; label: string }>;
}> {
  const c = db(sb);
  const [
    { data: sectors },
    { data: shares },
    { data: briefs },
    { data: threats },
    { data: projects },
    { data: memory },
  ] = await Promise.all([
    c.from("sectors").select("code,label").order("sort_order"),
    c
      .from("country_sectors")
      .select("sector_code,share_pct,confidence_grade")
      .eq("country_code", code),
    c.from("sector_dossier_briefs").select("sector_code,brief").eq("country_code", code),
    c.from("fdi_threats").select("target_sector_codes,severity_pct").eq("country_code", code),
    c
      .from("investment_projects")
      .select("sector")
      .eq("country_code", code)
      .eq("approval_status", "approved"),
    c
      .from("memory_objects")
      .select("sector_code")
      .eq("scope_key", code)
      .not("sector_code", "is", null)
      .limit(2000),
  ]);
  const list = (sectors ?? []) as Array<{ code: string; label: string }>;
  const shareBy = new Map(
    (
      (shares ?? []) as Array<{ sector_code: string; share_pct: number; confidence_grade: string }>
    ).map((s) => [s.sector_code, s]),
  );
  const briefBy = new Map(
    ((briefs ?? []) as Array<{ sector_code: string; brief: Record<string, unknown> }>).map((b) => [
      b.sector_code,
      b.brief,
    ]),
  );
  const threatList = (threats ?? []) as Array<{
    target_sector_codes: string[];
    severity_pct: number;
  }>;
  const projectList = (projects ?? []) as Array<{ sector: string | null }>;
  const memCount = new Map<string, number>();
  for (const m of (memory ?? []) as Array<{ sector_code: string }>)
    memCount.set(m.sector_code, (memCount.get(m.sector_code) ?? 0) + 1);

  const base = (
    await Promise.all(
      [C.country(sb, code), C.kpis(sb, code), C.summaries(sb, code)].map((p) => p.catch(() => [])),
    )
  ).flat();

  const sectorLines = list.map((s) => {
    const sh = shareBy.get(s.code);
    const b = briefBy.get(s.code);
    const th = threatList.filter((t) => t.target_sector_codes?.includes(s.code));
    const pj = projectList.filter((p) => {
      const v = String(p.sector ?? "").toLowerCase();
      return v === s.code || v === s.label.toLowerCase();
    }).length;
    const parts = [
      `Sector ${s.label} (${s.code})`,
      sh
        ? `share of GDP ${Number(sh.share_pct).toFixed(1)}% (grade ${sh.confidence_grade})`
        : "share of GDP not recorded",
      b?.headline ? `brief: ${clip(b.headline, 200)}` : "no sector brief yet",
      b?.outlook ? `outlook: ${clip(b.outlook, 240)}` : null,
      th.length
        ? `${th.length} modelled threat(s), worst severity ${Math.max(...th.map((t) => Number(t.severity_pct)))}%`
        : null,
      pj ? `${pj} approved investment project(s)` : null,
      memCount.get(s.code) ? `${memCount.get(s.code)} second-brain entries` : null,
    ].filter(Boolean);
    return line(
      `scout.${s.code}`,
      parts.join(" — "),
      "corpus_row",
      `sectors:${s.code}`,
      `Sector profile — ${s.label}`,
    );
  });

  const secs = methodSections();
  const methodL = ["Evidence", "Seven ingredients"]
    .map((h) => [h, secs.get(h)] as const)
    .filter((x): x is readonly [string, string] => !!x[1])
    .map(([h, t]) =>
      line(
        `method.${h.toLowerCase().replace(/[^a-z]+/g, "_")}`,
        `Method — ${h}: ${clip(t, 2000)}`,
        "repo_file",
        "docs/prd/sector-studio-framework.md",
        `Sector Studio method — ${h}`,
      ),
    );

  const lines = [...base, ...sectorLines, ...methodL];
  const hash = await sha256Hex(lines.map((l) => `${l.key}\t${l.text}`).join("\n"));
  return { lines, hash, sectors: list };
}
