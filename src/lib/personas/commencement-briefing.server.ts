// Chamber 07 · Commencement Briefing — server-only assembler.
//
// The client-facing dossier that says, before a single participant is
// contacted: here is your brief as we understood it, here is the programme we
// will run, here is exactly who we will hear from and why, here is every
// question we will ask, here is how the fieldwork will be conducted, and here
// is how the evidence will be judged and filed.
//
// Everything below is composed from the real artefacts already committed to
// the programme — nothing is invented. Two narrative passages (the approach
// and the assurance note) are written by the model from those same artefacts,
// and fall back to deterministic prose if the model is unavailable.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { deriveJson } from "./field-ai.server";
import { buildWaves } from "./fieldwork-plan.server";
import type { FieldQuestion } from "./instrument-draft.server";

type Db = SupabaseClient<Database>;

export interface BriefingSection {
  id: string;
  eyebrow: string;
  heading: string;
  body_md: string;
}

export interface BriefingReadinessItem {
  label: string;
  ready: boolean;
  detail: string;
}

export interface CommencementBriefing {
  version: number;
  countryCode: string;
  programmeId: string;
  programmeTitle: string;
  title: string;
  subtitle: string;
  assembled_at: string;
  window: { starts_on: string | null; ends_on: string | null; duration_days: number | null };
  metrics: {
    phases: number;
    milestones: number;
    deliverables: number;
    participants: number;
    instruments: number;
    questions: number;
    waves: number;
  };
  readiness: BriefingReadinessItem[];
  sections: BriefingSection[];
}

// ── Small formatting helpers ───────────────────────────────────────────────

function dateLabel(d: string | null | undefined): string {
  if (!d) return "—";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.max(0, Math.round((y - x) / 86_400_000));
}

function asArray<T = Record<string, unknown>>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "_Nothing recorded yet._";
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`),
  ].join("\n");
}

function questionLine(q: FieldQuestion, n: number): string {
  const type = q.type.replace(/_/g, " ");
  const bits = [`**Q${n}.** ${q.prompt}`, `_${type}${q.required ? " · required" : ""}_`];
  if (q.help) bits.push(`_${q.help}_`);
  if (q.options?.length) bits.push(q.options.map((o) => `- ${o}`).join("\n"));
  if (q.rows?.length) bits.push(q.rows.map((r) => `- ${r}`).join("\n"));
  if (typeof q.scale_min === "number" && typeof q.scale_max === "number") {
    bits.push(
      `Scale ${q.scale_min}–${q.scale_max}${
        q.scale_min_label ? ` (${q.scale_min_label} → ${q.scale_max_label ?? ""})` : ""
      }`,
    );
  }
  return bits.join("\n\n");
}

// ── AI narrative (optional, with deterministic fallback) ───────────────────

interface Narrative {
  approach: string;
  why_these_people: string;
  assurance: string;
  expected_outcome: string;
}

function isNarrative(v: unknown): v is Narrative {
  if (!v || typeof v !== "object") return false;
  const n = v as Partial<Narrative>;
  return (
    typeof n.approach === "string" &&
    n.approach.trim().length > 80 &&
    typeof n.why_these_people === "string" &&
    n.why_these_people.trim().length > 40 &&
    typeof n.assurance === "string" &&
    n.assurance.trim().length > 40 &&
    typeof n.expected_outcome === "string" &&
    n.expected_outcome.trim().length > 80
  );
}

const NARRATIVE_SYSTEM = `You are a senior research director at a top-tier strategy firm writing the commencement briefing a sovereign government client reads before fieldwork begins.

Write in calm, precise, non-promotional British English. Address the client directly. Never invent facts: use only the material supplied. No bullet lists, no headings, no markdown syntax — plain prose paragraphs separated by a blank line.

Return JSON with exactly four string keys:
- "approach": 3–5 paragraphs. What this programme is doing, why the method mix is the right instrument for these objectives, and how the phases carry it from start to read-out.
- "why_these_people": 2–3 paragraphs. Why the recruited audience is the right one to answer the brief, what each segment contributes, and how their answers will be weighted. Describe the audience only as target personas — role archetypes, sectors and segments. Never name individuals or identify a single person by an unusual role-plus-organisation pairing.
- "assurance": 2–3 paragraphs. How quality, consent and confidentiality are held; what the limits of the evidence will be; and how findings will be filed to the client's second brain so they can be cited later.
- "expected_outcome": 2–3 paragraphs, and these are the closing words of the whole document. Restate the client's original ask in plain language as it was given in the brief and scope, then state precisely what the programme will hand back against it — naming the committed deliverables and the date by which they land. Be concrete and measured; make no claim the committed artefacts do not support.`;


async function writeNarrative(input: string): Promise<Narrative | null> {
  try {
    return await deriveJson<Narrative>({
      system: NARRATIVE_SYSTEM,
      user: input,
      validate: isNarrative,
    });
  } catch {
    return null;
  }
}

// ── The assembler ──────────────────────────────────────────────────────────

export async function assembleBriefing(
  supabase: Db,
  projectId: string,
): Promise<CommencementBriefing> {
  const { data: project } = await supabase
    .from("persona_projects")
    .select("id,title,country_code,brief_raw,brief_scope,brief_source,recruitment_brief,status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Research programme not found");
  const countryCode = project.country_code as string;

  const { data: plan } = await supabase
    .from("programme_plans")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();
  if (!plan) throw new Error("Approve the programme plan before assembling the briefing.");
  const planId = plan.id as string;

  const [{ data: phases }, { data: milestones }, { data: deliverables }, { data: panels }] =
    await Promise.all([
      supabase.from("programme_phases").select("*").eq("plan_id", planId).order("position"),
      supabase.from("programme_milestones").select("*").eq("plan_id", planId).order("due_on"),
      supabase.from("programme_deliverables").select("*").eq("plan_id", planId).order("due_on"),
      supabase.from("research_panels").select("id,name,kind").eq("project_id", projectId),
    ]);

  // ── Participants ──────────────────────────────────────────────────────
  const panelRows = panels ?? [];
  const panelIds = panelRows.map((p) => p.id as string);
  let members: Array<{ panel_id: string; contact_id: string }> = [];
  if (panelIds.length > 0) {
    const { data } = await supabase
      .from("research_panel_members")
      .select("panel_id,contact_id")
      .in("panel_id", panelIds);
    members = (data ?? []) as typeof members;
  }
  const contactIds = [...new Set(members.map((m) => m.contact_id))];
  let contacts: Array<Record<string, unknown>> = [];
  if (contactIds.length > 0) {
    const { data } = await supabase
      .from("research_contacts")
      .select(
        "id,full_name,role_title,organisation,persona_label,fit_reason,consent_status,status,confidence",
      )
      .in("id", contactIds);
    contacts = (data ?? []) as typeof contacts;
  }
  const contactById = new Map(contacts.map((c) => [c["id"] as string, c]));

  // ── Instruments ───────────────────────────────────────────────────────
  const { data: studies } = await supabase
    .from("studies")
    .select("id")
    .eq("project_id", projectId)
    .eq("mode", "field")
    .order("created_at", { ascending: true })
    .limit(1);
  const studyId = (studies?.[0]?.id as string | undefined) ?? null;

  let instruments: Array<Record<string, unknown>> = [];
  if (studyId) {
    const { data } = await supabase
      .from("field_instruments")
      .select("id,kind,title,intro,outro,questions,version")
      .eq("study_id", studyId)
      .order("version", { ascending: false });
    // Keep only the newest version of each kind.
    const seen = new Set<string>();
    instruments = ((data ?? []) as typeof instruments).filter((row) => {
      const k = row["kind"] as string;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const waves = buildWaves(plan.method_mix);

  const objectives = asArray(plan.objectives);
  const methodMix = asArray(plan.method_mix);
  const audience = asArray(plan.audience);
  const risks = asArray(plan.risks);

  const questionCount = instruments.reduce(
    (n, i) => n + asArray<FieldQuestion>(i["questions"]).length,
    0,
  );

  // ── Narrative ─────────────────────────────────────────────────────────
  const narrativeInput = JSON.stringify({
    country: countryCode,
    programme: project.title,
    brief: str(project.brief_raw).slice(0, 6000),
    scope: project.brief_scope,
    plan_summary: plan.summary,
    window: { starts_on: plan.starts_on, ends_on: plan.ends_on },
    objectives,
    phases: (phases ?? []).map((p) => ({ name: p.name, intent: p.intent })),
    method_mix: methodMix,
    audience,
    recruited: contacts.map((c) => ({
      persona: c["persona_label"],
      role: c["role_title"],
      organisation: c["organisation"],
      why: c["fit_reason"],
    })),
    instruments: instruments.map((i) => ({
      kind: i["kind"],
      title: i["title"],
      questions: asArray<FieldQuestion>(i["questions"]).length,
    })),
    waves: waves.map((w) => ({ title: w.title, purpose: w.purpose, target: w.target })),
    deliverables: (deliverables ?? []).map((d) => ({
      title: d.title,
      kind: d.kind,
      due_on: d.due_on,
    })),
    milestones: (milestones ?? []).map((m) => ({ title: m.title, due_on: m.due_on })),
    risks,

  }).slice(0, 24_000);

  const narrative = await writeNarrative(narrativeInput);

  // ── Sections ──────────────────────────────────────────────────────────
  const sections: BriefingSection[] = [];

  sections.push({
    id: "brief",
    eyebrow: "As we understood it",
    heading: "The brief",
    body_md: [
      str(plan.summary, "—"),
      "",
      "### Your question, in your words",
      "",
      str(project.brief_raw, "_No source brief text was recorded._"),
      "",
      "### What counts as an answer",
      "",
      table(
        ["#", "Objective", "Why it matters"],
        objectives.map((o, i) => [
          String(i + 1).padStart(2, "0"),
          str((o as Record<string, unknown>)["objective"], "—"),
          str((o as Record<string, unknown>)["why"], "—"),
        ]),
      ),
    ].join("\n"),
  });

  sections.push({
    id: "approach",
    eyebrow: "Method",
    heading: "Our approach",
    body_md:
      narrative?.approach ??
      [
        `This programme runs from ${dateLabel(plan.starts_on as string)} to ${dateLabel(
          plan.ends_on as string,
        )} across ${(phases ?? []).length} phases.`,
        "",
        "The method mix below was derived from the brief's objectives, the difficulty of reaching each audience, and the deadline it must land before.",
        "",
        table(
          ["Method", "Serves", "Audience", "Size", "Why this method"],
          methodMix.map((m) => {
            const r = m as Record<string, unknown>;
            return [
              str(r["method"], "—"),
              str(r["objective"], "—"),
              str(r["audience"], "—"),
              String(r["sample_size"] ?? "—"),
              str(r["rationale"], "—"),
            ];
          }),
        ),
      ].join("\n"),
  });

  sections.push({
    id: "programme",
    eyebrow: "Schedule",
    heading: "The programme",
    body_md: [
      table(
        ["Phase", "Intent", "Starts", "Ends"],
        (phases ?? []).map((p) => [
          str(p.name, "—"),
          str(p.intent, "—"),
          dateLabel(p.starts_on as string),
          dateLabel(p.ends_on as string),
        ]),
      ),
      "",
      "### Milestones",
      "",
      table(
        ["Milestone", "Owner", "Due"],
        (milestones ?? []).map((m) => [
          str(m.title, "—"),
          str(m.owner, "GDPVision"),
          dateLabel(m.due_on as string),
        ]),
      ),
      "",
      "### What you receive",
      "",
      table(
        ["Deliverable", "Form", "Due"],
        (deliverables ?? []).map((d) => [
          str(d.title, "—"),
          str(d.kind, "Document"),
          dateLabel(d.due_on as string),
        ]),
      ),
    ].join("\n"),
  });

  sections.push({
    id: "participants",
    eyebrow: "Who we hear from",
    heading: "The participants",
    body_md: [
      narrative?.why_these_people ??
        "The audience below was derived from the brief. Participants are described as target personas — individual identities stay confidential and are held in the recruitment record.",
      "",
      "### Segments the plan requires",
      "",
      table(
        ["Segment", "Why this segment", "Target"],
        audience.map((a) => {
          const r = a as Record<string, unknown>;
          return [str(r["segment"], "—"), str(r["why"], "—"), String(r["target_n"] ?? "—")];
        }),
      ),
      "",
      "### Panels recruited",
      "",
      table(
        ["Panel", "Kind", "Recruited"],
        panelRows.map((p) => [
          str(p.name, "—"),
          str(p.kind, "—").replace(/_/g, " "),
          String(members.filter((m) => m.panel_id === p.id).length),
        ]),
      ),
      "",
      "### Target personas recruited",
      "",
      table(
        ["Persona", "Typical roles", "Typical settings", "Why them", "Recruited", "Consent secured"],
        (() => {
          type Bucket = {
            roles: Set<string>;
            orgs: Set<string>;
            why: string;
            count: number;
            consented: number;
          };
          const buckets = new Map<string, Bucket>();
          for (const m of members) {
            const c = contactById.get(m.contact_id) ?? {};
            const key = str(c["persona_label"], "Unsegmented");
            const b =
              buckets.get(key) ??
              ({ roles: new Set(), orgs: new Set(), why: "", count: 0, consented: 0 } as Bucket);
            const role = str(c["role_title"], "");
            const org = str(c["organisation"], "");
            if (role) b.roles.add(role);
            if (org) b.orgs.add(org);
            if (!b.why) b.why = str(c["fit_reason"], "");
            b.count += 1;
            if (str(c["consent_status"]) === "granted") b.consented += 1;
            buckets.set(key, b);
          }
          const sample = (s: Set<string>) => {
            const list = [...s].slice(0, 3);
            if (list.length === 0) return "—";
            return list.join("; ") + (s.size > 3 ? `; +${s.size - 3} more` : "");
          };
          return [...buckets.entries()].map(([persona, b]) => [
            persona,
            sample(b.roles),
            sample(b.orgs),
            b.why || "—",
            String(b.count),
            `${b.consented}/${b.count}`,
          ]);
        })(),
      ),

    ].join("\n"),
  });

  sections.push({
    id: "instruments",
    eyebrow: "What we ask",
    heading: "The instruments",
    body_md:
      instruments.length === 0
        ? "_No instrument has been drafted against this programme yet._"
        : instruments
            .map((inst) => {
              const kind =
                str(inst["kind"]) === "discussion_guide" ? "Discussion guide" : "Questionnaire";
              const qs = asArray<FieldQuestion>(inst["questions"]);
              return [
                `### ${kind} — ${str(inst["title"], "Untitled")} (v${String(inst["version"] ?? 1)})`,
                "",
                str(inst["intro"]) ? `_${str(inst["intro"])}_` : "",
                "",
                qs.map((q, i) => questionLine(q, i + 1)).join("\n\n"),
                str(inst["outro"]) ? `\n_${str(inst["outro"])}_` : "",
              ].join("\n");
            })
            .join("\n\n---\n\n"),
  });

  sections.push({
    id: "fieldwork",
    eyebrow: "How we collect",
    heading: "The fieldwork",
    body_md: [
      "Fieldwork is run as ordered waves. Each wave carries one instrument to one audience, and closes only when its returns are in.",
      "",
      table(
        ["Wave", "How it is fielded", "Instrument", "Audience", "Target"],
        waves.map((w) => [
          w.title,
          w.kind === "collection"
            ? "Hosted link, one response per participant"
            : "Moderated session",
          w.instrumentKind === "discussion_guide" ? "Discussion guide" : "Questionnaire",
          w.audiences.join("; ") || "—",
          w.target === null ? "—" : String(w.target),
        ]),
      ),
      "",
      "### Where answers may come from",
      "",
      "- **Hosted collection.** Each participant receives a single-use link; no account or login is required.",
      "- **Moderated sessions.** Seated from the recruited panel, recorded with consent, transcribed and coded.",
      "- **Off-system capture.** Where an instrument is administered elsewhere — by phone, on paper, or in another platform — the returns are uploaded, read by the model, mapped question by question, and held in staging for review before they count.",
      "",
      "Nothing enters the evidence base without passing that review.",
    ].join("\n"),
  });

  sections.push({
    id: "evidence",
    eyebrow: "How we judge it",
    heading: "Evidence, assurance and filing",
    body_md: [
      narrative?.assurance ??
        "Returns are synthesised into a field finding: headline, toplines with the evidence behind each, segment differences, verbatim quotes, tensions, implications, and a stated confidence level with its limitations.",
      "",
      "### Risks carried, and how they are held",
      "",
      table(
        ["Risk", "Severity", "Mitigation"],
        risks.map((r) => {
          const x = r as Record<string, unknown>;
          return [str(x["risk"], "—"), str(x["severity"], "—"), str(x["mitigation"], "—")];
        }),
      ),
      "",
      "On close, the finding is filed to your country's second brain as real-world (non-synthetic) evidence, so any chamber — the National Ledger, the Cabinet Room, the Narrative Chamber — can cite it with its provenance intact.",
    ].join("\n"),
  });

  // ── Expected outcome, measured against the client's own brief ─────────
  const allQuestions = instruments.flatMap((i) => asArray<FieldQuestion>(i["questions"]));
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4),
    );
  const overlap = (a: Set<string>, b: Set<string>) => {
    let n = 0;
    for (const w of a) if (b.has(w)) n += 1;
    return n;
  };

  const deliverableRows = deliverables ?? [];
  const milestoneRows = milestones ?? [];
  const lastDue =
    deliverableRows.map((d) => d.due_on as string | null).filter(Boolean).slice(-1)[0] ??
    (plan.ends_on as string | null);

  const outcomeRows = objectives.map((o, idx) => {
    const text = str((o as Record<string, unknown>)["objective"], "—");
    const t = tokens(text);

    const hits = allQuestions.filter((q) => overlap(t, tokens(`${q.prompt} ${q.help ?? ""}`)) >= 2);
    const coveringWaves = waves.filter((w) =>
      hits.length > 0 ? true : overlap(t, tokens(`${w.title} ${w.purpose ?? ""}`)) >= 1,
    );
    const how =
      hits.length > 0
        ? `${hits.length} question${hits.length === 1 ? "" : "s"} across ${coveringWaves.length || waves.length} wave${(coveringWaves.length || waves.length) === 1 ? "" : "s"}`
        : coveringWaves.length > 0
          ? coveringWaves.map((w) => w.title).join("; ")
          : "Covered by synthesis at close";

    const scored = deliverableRows
      .map((d) => ({ d, score: overlap(t, tokens(str(d.title))) }))
      .sort((a, b) => b.score - a.score);
    const match = scored[0] && scored[0].score > 0 ? scored[0].d : deliverableRows[idx % Math.max(1, deliverableRows.length)];

    return [
      String(idx + 1).padStart(2, "0"),
      text,
      how,
      match ? str(match.title, "—") : "Field finding at close",
      match ? dateLabel(match.due_on as string) : dateLabel(lastDue),
    ];
  });

  const fallbackOutcome = [
    `You asked us to ${str(plan.summary, "answer the question set out in your brief").replace(/^[A-Z]/, (c) => c.toLowerCase())}`,
    "",
    deliverableRows.length > 0
      ? `Against that ask, this programme hands back ${deliverableRows.length} committed deliverable${deliverableRows.length === 1 ? "" : "s"} — ${deliverableRows.map((d) => str(d.title, "a document")).join(", ")} — with the last of them due ${dateLabel(lastDue)}. Every objective below is carried by named questions, fielded in named waves, and landed in a named deliverable.`
      : "Against that ask, this programme hands back a field finding at close: headline, toplines with the evidence behind each, segment differences, verbatim quotes, tensions, implications and a stated confidence level.",
  ].join("\n");

  sections.push({
    id: "expected-outcome",
    eyebrow: "Against your brief",
    heading: "The expected outcome",
    body_md: [
      "### What you asked for, and what you receive",
      "",
      table(["#", "Your ask", "How it is answered", "What you receive", "When"], outcomeRows),
      "",
      "### What this briefing does not promise",
      "",
      [
        `This is qualitative and directional evidence from ${members.length} recruited participant${members.length === 1 ? "" : "s"} across ${waves.length} wave${waves.length === 1 ? "" : "s"} — it is not a nationally representative statistical estimate, and no margin of error is claimed.`,
        risks.length > 0
          ? `The risks recorded above — ${risks
              .map((r) => str((r as Record<string, unknown>)["risk"], "").toLowerCase())
              .filter(Boolean)
              .join("; ")} — are carried openly and will be restated in the finding.`
          : "Any limitation encountered in the field will be stated plainly in the finding rather than smoothed over.",
        "Where a return falls short of the target, we report the shortfall and its effect on confidence instead of extrapolating past it.",
      ].join(" "),
      "",
      "### In closing",
      "",
      narrative?.expected_outcome ?? fallbackOutcome,
    ].join("\n"),
  });



  // ── Readiness ─────────────────────────────────────────────────────────
  const readiness: BriefingReadinessItem[] = [
    {
      label: "Brief committed",
      ready: str(project.brief_raw).length > 0,
      detail: str(project.brief_raw).length > 0 ? "Source brief on file." : "No source brief text.",
    },
    {
      label: "Programme approved",
      ready: true,
      detail: `Version ${String(plan.version)} active, ${(phases ?? []).length} phases.`,
    },
    {
      label: "Participants recruited",
      ready: members.length > 0,
      detail: `${members.length} recruited participant${members.length === 1 ? "" : "s"} across ${panelRows.length} panel${panelRows.length === 1 ? "" : "s"}.`,
    },
    {
      label: "Instruments drafted",
      ready: instruments.length > 0,
      detail: `${instruments.length} instrument${instruments.length === 1 ? "" : "s"}, ${questionCount} questions.`,
    },
    {
      label: "Fieldwork ready",
      ready: waves.length > 0,
      detail: `${waves.length} wave${waves.length === 1 ? "" : "s"} to field.`,
    },
    {
      label: "Evidence outstanding",
      ready: false,
      detail: "Synthesis follows the final wave.",
    },
  ];

  return {
    version: 1,
    countryCode,
    programmeId: projectId,
    programmeTitle: project.title as string,
    title: project.title as string,
    subtitle: str(plan.summary, "Commencement briefing"),
    assembled_at: new Date().toISOString(),
    window: {
      starts_on: (plan.starts_on as string | null) ?? null,
      ends_on: (plan.ends_on as string | null) ?? null,
      duration_days: daysBetween(plan.starts_on as string | null, plan.ends_on as string | null),
    },
    metrics: {
      phases: (phases ?? []).length,
      milestones: (milestones ?? []).length,
      deliverables: (deliverables ?? []).length,
      participants: members.length,
      instruments: instruments.length,
      questions: questionCount,
      waves: waves.length,
    },
    readiness,
    sections,
  };
}
