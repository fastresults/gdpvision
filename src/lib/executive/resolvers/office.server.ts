// @domain executive
// @tables intake_items,comms_artifacts,cabinet_sessions,cabinet_agenda_items,commitments,studies,persona_segments,study_responses,compact_pledges,compact_deliverables,compact_scorecards,mandate_compacts
// @ui src/components/executive/ExecutiveDashboard.tsx
//
// Resolvers for chambers 05–08.

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
const hoursSince = (iso: string | null) =>
  iso ? Math.floor((Date.now() - Date.parse(iso)) / 3_600_000) : null;

/** Chamber 05 · The Narrative Chamber */
export async function resolveNarrative(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("05", "The Narrative Chamber", "/admin/countries/$code/narrative", "Office of the Prime Minister", [
    "Signals open",
    "Awaiting clearance",
    "Published 30d",
  ]);
  try {
    const [sigRes, artRes] = await Promise.all([
      sb
        .from("intake_items")
        .select("id,topic,state,severity,created_at,reviewed_at")
        .eq("scope_key", cc)
        .order("created_at", { ascending: false })
        .limit(500),
      sb
        .from("comms_artifacts")
        .select("id,title,kind,draft_state,created_at,updated_at,published_at,scheduled_for,deleted_at")
        .eq("scope_key", cc)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(300),
    ]);

    const signals = sigRes.data ?? [];
    const artifacts = artRes.data ?? [];
    const openStates = new Set(["new", "pending", "triage", "proposed"]);
    const open = signals.filter((s: any) => openStates.has(String(s.state ?? "").toLowerCase()));
    const awaiting = artifacts.filter(
      (a: any) => !a.published_at && !["published", "released"].includes(String(a.draft_state ?? "").toLowerCase()),
    );
    const cutoff = Date.now() - 30 * 86_400_000;
    const published = artifacts.filter((a: any) => a.published_at && Date.parse(a.published_at) > cutoff);

    const oldestOpen = [...open].sort((a: any, b: any) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
    const ageH = hoursSince(oldestOpen?.created_at ?? null);
    const stamps = [
      ...signals.map((s: any) => s.created_at),
      ...artifacts.map((a: any) => a.updated_at ?? a.created_at),
    ];
    const nextScheduled = artifacts
      .filter((a: any) => a.scheduled_for && Date.parse(a.scheduled_for) > Date.now())
      .sort((a: any, b: any) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for))[0];

    return {
      ...base,
      kpis: [
        {
          label: "Signals open",
          value: signals.length ? num(open.length) : null,
          tone: open.length > 8 ? "negative" : open.length > 3 ? "caution" : "positive",
        },
        {
          label: "Awaiting clearance",
          value: artifacts.length ? num(awaiting.length) : null,
          tone: awaiting.length > 4 ? "caution" : "neutral",
        },
        { label: "Published 30d", value: artifacts.length ? num(published.length) : null },
      ],
      tempo: bucketTempo(stamps),
      last_activity_at: newest(stamps),
      next_due: nextScheduled
        ? { label: `Release · ${nextScheduled.title ?? nextScheduled.kind}`, at: nextScheduled.scheduled_for }
        : oldestOpen
          ? { label: "Oldest untriaged signal", at: oldestOpen.created_at }
          : null,
      recent: [...artifacts]
        .filter((a: any) => a.updated_at ?? a.created_at)
        .slice(0, 10)
        .map((a: any) => ({
          at: a.updated_at ?? a.created_at,
          text: `${a.title ?? a.kind} · ${a.draft_state ?? "draft"}`,
        })),
      alerts:
        ageH !== null && ageH >= 12
          ? [
              {
                chamber: "05",
                text: `Signal open ${ageH}h with no response drafted — ${oldestOpen.topic ?? "untitled"}`,
                severity: 55 + Math.min(ageH / 2, 30),
                because: [`open ${ageH}h`, "no draft", "public-facing"],
              },
            ]
          : [],
      health: (open.length > 8 ? "negative" : open.length ? "caution" : artifacts.length ? "positive" : "quiet") as Tone,
    };
  } catch {
    return base;
  }
}

/** Chamber 06 · The Cabinet Room */
export async function resolveCabinet(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("06", "The Cabinet Room", "/admin/countries/$code/cabinet", "Cabinet Secretary", [
    "Next session",
    "Items unprepared",
    "Commitments overdue",
  ]);
  try {
    const [sesRes, comRes] = await Promise.all([
      sb
        .from("cabinet_sessions")
        .select("id,title,scheduled_for,held_at,created_at,updated_at")
        .eq("country_code", cc)
        .order("scheduled_for", { ascending: true })
        .limit(50),
      sb
        .from("commitments")
        .select("id,title,status,due_at,created_at")
        .eq("country_code", cc)
        .limit(500),
    ]);

    const sessions = sesRes.data ?? [];
    const commitments = comRes.data ?? [];
    const upcoming = sessions
      .filter((s: any) => s.scheduled_for && Date.parse(s.scheduled_for) > Date.now())
      .sort((a: any, b: any) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for))[0];

    let unprepared = 0;
    if (upcoming) {
      const ag = await sb
        .from("cabinet_agenda_items")
        .select("id,status,readiness_score")
        .eq("session_id", upcoming.id)
        .limit(100);
      unprepared = (ag.data ?? []).filter(
        (i: any) => !["ready", "approved", "closed"].includes(String(i.status ?? "").toLowerCase()),
      ).length;
    }

    const closed = new Set(["done", "complete", "completed", "closed", "delivered"]);
    const overdue = commitments.filter(
      (c: any) => c.due_at && Date.parse(c.due_at) < Date.now() && !closed.has(String(c.status ?? "").toLowerCase()),
    );
    const daysToSession = upcoming
      ? Math.ceil((Date.parse(upcoming.scheduled_for) - Date.now()) / 86_400_000)
      : null;
    const stamps = [
      ...sessions.map((s: any) => s.updated_at ?? s.created_at),
      ...commitments.map((c: any) => c.created_at),
    ];

    return {
      ...base,
      kpis: [
        {
          label: "Next session",
          value: daysToSession === null ? null : daysToSession === 0 ? "today" : `${daysToSession}d`,
          tone: daysToSession !== null && daysToSession <= 3 ? "caution" : "neutral",
        },
        {
          label: "Items unprepared",
          value: upcoming ? num(unprepared) : null,
          tone: unprepared > 0 ? "caution" : "positive",
        },
        {
          label: "Commitments overdue",
          value: commitments.length ? num(overdue.length) : null,
          tone: overdue.length > 3 ? "negative" : overdue.length ? "caution" : "positive",
        },
      ],
      tempo: bucketTempo(stamps),
      last_activity_at: newest(stamps),
      next_due: upcoming ? { label: upcoming.title ?? "Cabinet session", at: upcoming.scheduled_for } : null,
      recent: [...commitments]
        .filter((c: any) => c.created_at)
        .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 10)
        .map((c: any) => ({ at: c.created_at, text: `${c.title} · ${c.status ?? "open"}` })),
      alerts: [
        ...(upcoming && unprepared > 0 && (daysToSession ?? 99) <= 7
          ? [
              {
                chamber: "06",
                text: `Cabinet convenes in ${daysToSession}d — ${unprepared} item${unprepared === 1 ? "" : "s"} unprepared`,
                severity: 80 - (daysToSession ?? 0) * 5 + unprepared * 2,
                because: [`${daysToSession}d to session`, `${unprepared} unprepared`, "Cabinet-linked"],
              },
            ]
          : []),
        ...(overdue.length > 0
          ? [
              {
                chamber: "06",
                text: `${overdue.length} cabinet commitment${overdue.length === 1 ? "" : "s"} past due`,
                severity: 50 + Math.min(overdue.length * 4, 25),
                because: [`${overdue.length} overdue`, "decision follow-through"],
              },
            ]
          : []),
      ],
      health: (overdue.length > 3 ? "negative" : upcoming ? "positive" : "quiet") as Tone,
    };
  } catch {
    return base;
  }
}

/** Chamber 07 · The Research Chamber */
export async function resolvePersonas(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("07", "The Research Chamber", "/admin/countries/$code/personas", "Policy research", [
    "Studies running",
    "Segments",
    "Responses",
  ]);
  try {
    const [stuRes, segRes] = await Promise.all([
      sb
        .from("studies")
        .select("id,title,status,created_at,updated_at")
        .eq("country_code", cc)
        .limit(300),
      sb.from("persona_segments").select("id,label,updated_at,created_at").eq("country_code", cc).limit(300),
    ]);

    const studies = stuRes.data ?? [];
    const segments = segRes.data ?? [];
    const running = studies.filter((s: any) =>
      ["running", "in_progress", "active", "fielding"].includes(String(s.status ?? "").toLowerCase()),
    );

    let responses = 0;
    if (studies.length) {
      const ids = studies.map((s: any) => s.id).slice(0, 200);
      const r = await sb
        .from("study_responses")
        .select("id", { count: "exact", head: true })
        .in("study_id", ids);
      responses = r.count ?? 0;
    }

    const stamps = [
      ...studies.map((s: any) => s.updated_at ?? s.created_at),
      ...segments.map((s: any) => s.updated_at ?? s.created_at),
    ];

    return {
      ...base,
      kpis: [
        { label: "Studies running", value: studies.length ? num(running.length) : null },
        { label: "Segments", value: segments.length ? num(segments.length) : null },
        { label: "Responses", value: studies.length ? num(responses) : null },
      ],
      tempo: bucketTempo(stamps),
      last_activity_at: newest(stamps),
      next_due: null,
      recent: [...studies]
        .filter((s: any) => s.updated_at ?? s.created_at)
        .sort((a: any, b: any) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at))
        .slice(0, 10)
        .map((s: any) => ({ at: s.updated_at ?? s.created_at, text: `${s.title} · ${s.status ?? "draft"}` })),
      alerts: [],
      health: (running.length ? "positive" : studies.length ? "neutral" : "quiet") as Tone,
    };
  } catch {
    return base;
  }
}

/** Chamber 08 · The Mandate Compact */
export async function resolveMandate(sb: Db, cc: string): Promise<ChamberSummary> {
  const base = emptyChamber("08", "The Mandate Compact", "/admin/countries/$code/mandate-compact", "Office of the Principal", [
    "Pledges",
    "Deliverables",
    "Weighted progress",
  ]);
  try {
    const [pleRes, delRes, scoRes] = await Promise.all([
      sb.from("compact_pledges").select("id,title,created_at,updated_at").eq("country_code", cc).limit(1000),
      sb
        .from("compact_deliverables")
        .select("id,title,risk_level,signed_off_at,created_at,updated_at")
        .eq("country_code", cc)
        .limit(1000),
      sb
        .from("compact_scorecards")
        .select("on_track_pct,at_risk_pct,off_track_pct,delivered_pct,weighted_progress,period,computed_at")
        .eq("country_code", cc)
        .order("computed_at", { ascending: false })
        .limit(1),
    ]);

    const pledges = pleRes.data ?? [];
    const deliverables = delRes.data ?? [];
    const score = (scoRes.data ?? [])[0];
    const atRisk = deliverables.filter((d: any) =>
      ["high", "critical", "at_risk"].includes(String(d.risk_level ?? "").toLowerCase()),
    );
    const stamps = [
      ...pledges.map((p: any) => p.updated_at ?? p.created_at),
      ...deliverables.map((d: any) => d.updated_at ?? d.created_at),
    ];
    const idle = daysSince(newest(stamps));

    return {
      ...base,
      kpis: [
        { label: "Pledges", value: pledges.length ? num(pledges.length) : null },
        {
          label: "Deliverables",
          value: deliverables.length ? num(deliverables.length) : null,
          tone: atRisk.length ? "caution" : "neutral",
        },
        {
          label: "Weighted progress",
          value: score?.weighted_progress != null ? `${Math.round(Number(score.weighted_progress))}%` : null,
          tone:
            score?.weighted_progress == null
              ? "quiet"
              : Number(score.weighted_progress) >= 60
                ? "positive"
                : Number(score.weighted_progress) >= 35
                  ? "caution"
                  : "negative",
        },
      ],
      tempo: bucketTempo(stamps),
      last_activity_at: newest(stamps),
      next_due: null,
      recent: [...deliverables]
        .filter((d: any) => d.updated_at ?? d.created_at)
        .sort((a: any, b: any) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at))
        .slice(0, 10)
        .map((d: any) => ({ at: d.updated_at ?? d.created_at, text: `${d.title} · ${d.risk_level ?? "risk unset"}` })),
      alerts: [
        ...(atRisk.length > 0
          ? [
              {
                chamber: "08",
                text: `${atRisk.length} manifesto deliverable${atRisk.length === 1 ? "" : "s"} flagged high risk`,
                severity: 45 + Math.min(atRisk.length * 3, 25),
                because: [`${atRisk.length} at risk`, "manifesto commitment"],
              },
            ]
          : []),
        ...(pledges.length > 0 && (idle ?? 0) > 45
          ? [
              {
                chamber: "08",
                text: `Mandate tracking untouched for ${idle} days`,
                severity: 30,
                because: [`idle ${idle}d`],
              },
            ]
          : []),
      ],
      health: (atRisk.length ? "caution" : pledges.length ? "positive" : "quiet") as Tone,
    };
  } catch {
    return base;
  }
}
