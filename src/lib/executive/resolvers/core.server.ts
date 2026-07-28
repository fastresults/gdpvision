// @domain executive
// @tables country_kpis,grade_alerts,ministries,ministry_profiles,sector_dossiers,scenarios,fdi_threats,fdi_playbook_actions,exposure_index
// @ui src/components/executive/ExecutiveDashboard.tsx
//
// Resolvers for chambers 01–04. Each returns a ChamberSummary and never
// throws — a failure degrades to the quiet card from emptyChamber().

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  bucketTempo,
  daysSince,
  emptyChamber,
  newest,
  type ChamberSummary,
  type Tone,
} from "../types";

type Db = SupabaseClient<any, "public", any>;

const num = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Chamber 01 · The National Ledger */
export async function resolveLedger(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("01", "The National Ledger", "/admin/countries/$code/ledger", "Office of the Steward", [
    "KPIs on record",
    "Grade A/B",
    "Open QA",
  ]);
  try {
    const [kpiRes, alertRes] = await Promise.all([
      sb
        .from("country_kpis")
        .select("id,label,latest_value,confidence,updated_at,last_verified_at")
        .eq("country_code", cc)
        .limit(2000),
      sb
        .from("grade_alerts")
        .select("id,sector_code,reason,created_at,acknowledged_at")
        .eq("country_code", cc)
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const rows = kpiRes.data ?? [];
    const onRecord = rows.filter((r: any) => r.latest_value !== null && r.latest_value !== undefined);
    const graded = onRecord.filter((r: any) => ["A", "B"].includes(String(r.confidence ?? "").toUpperCase()));
    const openQa = alertRes.data ?? [];

    const oldestVerified = [...onRecord]
      .filter((r: any) => r.last_verified_at)
      .sort((a: any, b: any) => Date.parse(a.last_verified_at) - Date.parse(b.last_verified_at))[0];
    const staleDays = daysSince(oldestVerified?.last_verified_at ?? null);

    const share = onRecord.length ? graded.length / onRecord.length : null;

    return {
      ...base,
      kpis: [
        { label: "KPIs on record", value: onRecord.length ? num(onRecord.length) : null },
        {
          label: "Grade A/B",
          value: share === null ? null : pct(share),
          tone: share === null ? "quiet" : share >= 0.7 ? "positive" : share >= 0.4 ? "caution" : "negative",
        },
        {
          label: "Open QA",
          value: num(openQa.length),
          tone: openQa.length === 0 ? "positive" : openQa.length > 5 ? "negative" : "caution",
        },
      ],
      tempo: bucketTempo(rows.map((r: any) => r.updated_at)),
      last_activity_at: newest(rows.map((r: any) => r.updated_at)),
      next_due:
        oldestVerified && staleDays !== null
          ? { label: `Re-verify ${oldestVerified.label ?? "series"}`, at: oldestVerified.last_verified_at }
          : null,
      recent: [...rows]
        .filter((r: any) => r.updated_at)
        .sort((a: any, b: any) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, 3)
        .map((r: any) => ({ at: r.updated_at, text: `${r.label ?? r.id} updated` })),
      alerts: [
        ...(staleDays !== null && staleDays > 90
          ? [
              {
                chamber: "01",
                text: `${oldestVerified.label ?? "A series"} unverified for ${staleDays} days`,
                severity: 40 + Math.min(staleDays / 10, 30),
                because: [`stale ${staleDays}d`, "ledger feeds every chamber"],
              },
            ]
          : []),
        ...(openQa.length > 0
          ? [
              {
                chamber: "01",
                text: `${openQa.length} unacknowledged data-quality alert${openQa.length === 1 ? "" : "s"}`,
                severity: 35 + Math.min(openQa.length * 4, 30),
                because: [`${openQa.length} open`, "confidence grade fell"],
              },
            ]
          : []),
      ],
      health: (openQa.length > 5 ? "negative" : share !== null && share < 0.4 ? "caution" : "positive") as Tone,
    };
  } catch {
    return base;
  }
}

/** Chamber 02 · Portfolio Workspaces */
export async function resolvePortfolios(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("02", "Portfolio Workspaces", "/admin/countries/$code/portfolio", "Line ministries", [
    "Ministries",
    "Ministers named",
    "Sector dossiers",
  ]);
  try {
    const [minRes, profRes, dosRes] = await Promise.all([
      sb.from("ministries").select("id,name,updated_at").eq("country_code", cc).limit(200),
      sb
        .from("ministry_profiles")
        .select("id,ministry_slug,minister,updated_at")
        .eq("country_code", cc)
        .limit(200),
      sb
        .from("sector_dossiers")
        .select("id,sector_code,kind,updated_at")
        .eq("country_code", cc)
        .limit(500),
    ]);

    const ministries = minRes.data ?? [];
    const profiles = profRes.data ?? [];
    const dossiers = dosRes.data ?? [];
    const named = profiles.filter((p: any) => p.minister);
    const sectors = new Set(dossiers.map((d: any) => d.sector_code));
    const stamps = [
      ...profiles.map((p: any) => p.updated_at),
      ...dossiers.map((d: any) => d.updated_at),
    ];
    const gap = ministries.length - named.length;

    return {
      ...base,
      kpis: [
        { label: "Ministries", value: ministries.length ? num(ministries.length) : null },
        {
          label: "Ministers named",
          value: profiles.length ? `${named.length}/${ministries.length || profiles.length}` : null,
          tone: gap > 0 ? "caution" : "positive",
        },
        { label: "Sectors dossiered", value: sectors.size ? num(sectors.size) : null },
      ],
      tempo: bucketTempo(stamps),
      last_activity_at: newest(stamps),
      next_due: null,
      recent: [...dossiers]
        .filter((d: any) => d.updated_at)
        .sort((a: any, b: any) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, 3)
        .map((d: any) => ({ at: d.updated_at, text: `${d.sector_code} · ${d.kind} dossier refreshed` })),
      alerts:
        gap > 0
          ? [
              {
                chamber: "02",
                text: `${gap} ministr${gap === 1 ? "y has" : "ies have"} no minister on record`,
                severity: 25 + Math.min(gap * 3, 20),
                because: [`${gap} unnamed`, "blocks portfolio briefing"],
              },
            ]
          : [],
      health: (gap > 0 ? "caution" : ministries.length ? "positive" : "quiet") as Tone,
    };
  } catch {
    return base;
  }
}

/** Chamber 03 · The Scenario Engine */
export async function resolveScenarios(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("03", "The Scenario Engine", "/admin/countries/$code/scenarios", "Office of the Principal", [
    "Live scenarios",
    "Adopted",
    "Drafts",
  ]);
  try {
    const res = await sb
      .from("scenarios")
      .select("id,title,status,updated_at,created_at")
      .eq("country_code", cc)
      .limit(500);
    const rows = res.data ?? [];
    const live = rows.filter((r: any) => r.status !== "archived");
    const adopted = rows.filter((r: any) => r.status === "adopted");
    const drafts = rows.filter((r: any) => r.status === "draft");
    const stamps = rows.map((r: any) => r.updated_at ?? r.created_at);
    const idleDays = daysSince(newest(stamps));

    return {
      ...base,
      kpis: [
        { label: "Live scenarios", value: rows.length ? num(live.length) : null },
        { label: "Adopted", value: rows.length ? num(adopted.length) : null, tone: adopted.length ? "positive" : "quiet" },
        { label: "Drafts", value: rows.length ? num(drafts.length) : null, tone: drafts.length > 4 ? "caution" : "neutral" },
      ],
      tempo: bucketTempo(stamps),
      last_activity_at: newest(stamps),
      next_due: null,
      recent: [...rows]
        .filter((r: any) => r.updated_at)
        .sort((a: any, b: any) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, 3)
        .map((r: any) => ({ at: r.updated_at, text: `${r.title} · ${r.status}` })),
      alerts:
        drafts.length >= 3 && (idleDays ?? 0) > 14
          ? [
              {
                chamber: "03",
                text: `${drafts.length} scenarios stalled in draft for ${idleDays} days`,
                severity: 20 + Math.min(drafts.length * 2, 15),
                because: [`${drafts.length} drafts`, `idle ${idleDays}d`],
              },
            ]
          : [],
      health: (rows.length ? "positive" : "quiet") as Tone,
    };
  } catch {
    return base;
  }
}

/** Chamber 04 · The FDI Transition Studio */
export async function resolveStudio(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("04", "The FDI Transition Studio", "/admin/countries/$code/studio", "Ministry of Finance", [
    "Threats logged",
    "Open actions",
    "Exposure index",
  ]);
  try {
    const [thrRes, actRes, expRes] = await Promise.all([
      sb.from("fdi_threats").select("id,name,severity_pct,updated_at,created_at").eq("country_code", cc).limit(200),
      sb
        .from("fdi_playbook_actions")
        .select("id,action,horizon,status,updated_at,created_at")
        .eq("country_code", cc)
        .limit(500),
      sb
        .from("exposure_index")
        .select("value,period,confidence_grade,created_at")
        .eq("country_code", cc)
        .order("period", { ascending: false })
        .limit(1),
    ]);

    const threats = thrRes.data ?? [];
    const actions = actRes.data ?? [];
    const done = new Set(["done", "complete", "completed", "delivered"]);
    const open = actions.filter((a: any) => !done.has(String(a.status ?? "").toLowerCase()));
    const exposure = (expRes.data ?? [])[0];
    const stamps = [
      ...threats.map((t: any) => t.updated_at ?? t.created_at),
      ...actions.map((a: any) => a.updated_at ?? a.created_at),
    ];
    const idleDays = daysSince(newest(stamps));
    const worst = [...threats].sort((a: any, b: any) => (b.severity_pct ?? 0) - (a.severity_pct ?? 0))[0];

    return {
      ...base,
      kpis: [
        { label: "Threats logged", value: threats.length ? num(threats.length) : null },
        {
          label: "Open actions",
          value: actions.length ? num(open.length) : null,
          tone: open.length > 12 ? "caution" : "neutral",
        },
        {
          label: "Exposure index",
          value: exposure?.value != null ? Number(exposure.value).toFixed(2) : null,
        },
      ],
      tempo: bucketTempo(stamps),
      last_activity_at: newest(stamps),
      next_due: null,
      recent: [...actions]
        .filter((a: any) => a.updated_at ?? a.created_at)
        .sort((a: any, b: any) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at))
        .slice(0, 3)
        .map((a: any) => ({ at: a.updated_at ?? a.created_at, text: `${a.horizon ?? "action"} · ${a.action}` })),
      alerts:
        threats.length > 0 && actions.length === 0
          ? [
              {
                chamber: "04",
                text: `${worst?.name ?? "A threat"} is logged with no playbook actions`,
                severity: 45,
                because: ["threat without response", `severity ${Math.round(worst?.severity_pct ?? 0)}%`],
              },
            ]
          : (idleDays ?? 0) > 30 && threats.length > 0
            ? [
                {
                  chamber: "04",
                  text: `FDI posture untouched for ${idleDays} days`,
                  severity: 22,
                  because: [`idle ${idleDays}d`],
                },
              ]
            : [],
      health: (threats.length && actions.length === 0 ? "negative" : threats.length ? "positive" : "quiet") as Tone,
    };
  } catch {
    return base;
  }
}
