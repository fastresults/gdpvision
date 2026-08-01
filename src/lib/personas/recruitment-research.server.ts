// Chamber 07 · Stage 02 · AI-first participant recruitment — server only.
//
// Two derivations and one deep-research loop:
//
//   1) deriveRecruitmentFrame — reads the source brief, the approved plan and
//      the country context, and returns 3–6 target personas with survey and
//      focus-group targets. Nothing is templated; the frame is the brief's.
//   2) researchPersonaCandidates — one Perplexity `sonar-reasoning-pro`
//      fan-out per persona, returning REAL, publicly identifiable individuals.
//      Every candidate must carry an https source_url or it is dropped.
//   3) composeGroups — balances accepted candidates into focus-group slates.
//
// Nothing here writes to the database; recruitment.functions.ts owns that.

import { callSonar, parseSonarJson, type SonarCitation } from "@/lib/country-onboarding/perplexity.server";
import { deriveJson } from "./field-ai.server";

// ── Shapes ─────────────────────────────────────────────────────────────────

export interface RecruitmentPersona {
  label: string;
  who: string;
  why: string;
  seniority?: string | null;
  sector?: string | null;
  region?: string | null;
  survey_target: number;
  focus_group: boolean;
  where_to_look?: string[];
}

export interface RecruitmentFrame {
  summary: string;
  personas: RecruitmentPersona[];
  screening: string[];
  exclusions: string[];
  derived_at?: string;
}

export interface CandidateRecord {
  full_name: string;
  role_title: string | null;
  organisation: string | null;
  email: string | null;
  fit_reason: string;
  confidence: "high" | "medium" | "low";
  source_url: string;
  suggested_for: Array<"survey" | "focus_group">;
}

export interface PersonaResearchResult {
  persona: string;
  candidates: CandidateRecord[];
  citations: SonarCitation[];
  notes: string[];
}

// ── Frame derivation ───────────────────────────────────────────────────────

const FRAME_SYSTEM = `You are a senior field-research director recruiting real participants for a sovereign government research programme.

Read the brief and the approved plan, then define the recruitment frame: WHO must be heard from for the finding to be defensible, and how many of each.

Rules:
- 3 to 6 personas, each specific to THIS brief's subject, sector and country. Never generic ("General public", "Stakeholders") unless the brief genuinely calls for a population sample, and then say which population.
- Each persona carries: label (<= 5 words), who (one sentence describing the person), why (why this programme fails without them), seniority, sector, region, survey_target (an integer sample size you can defend), focus_group (true when this persona belongs in a moderated group), and where_to_look (2-5 concrete institution types, registries or associations where such people are publicly listed).
- Sample sizes must be defensible for the method mix in the plan, and realistic for the country's population and institutional size. A micro-state does not have 400 hoteliers.
- screening: 2-5 plain-language qualifying tests. exclusions: 1-4 people who must NOT be recruited (conflicted, already consulted, out of scope).
Return ONE JSON object: {"summary":"...","personas":[...],"screening":[...],"exclusions":[...]}`;

function isFrame(v: unknown): v is RecruitmentFrame {
  if (!v || typeof v !== "object") return false;
  const f = v as Partial<RecruitmentFrame>;
  if (typeof f.summary !== "string" || f.summary.trim().length < 20) return false;
  if (!Array.isArray(f.personas) || f.personas.length < 2) return false;
  return f.personas.every(
    (p) =>
      p &&
      typeof p.label === "string" &&
      p.label.trim().length >= 3 &&
      typeof p.who === "string" &&
      p.who.trim().length >= 8 &&
      typeof p.why === "string",
  );
}

export async function deriveRecruitmentFrame(input: {
  countryName: string;
  countryCode: string;
  title: string;
  briefText: string;
  planSummary?: string | null;
  methodMix?: unknown;
  audience?: unknown;
  steering?: string | null;
}): Promise<RecruitmentFrame> {
  const user = [
    `COUNTRY: ${input.countryName} (${input.countryCode})`,
    `PROGRAMME: ${input.title}`,
    "",
    "SOURCE BRIEF:",
    input.briefText.slice(0, 12_000),
    input.planSummary ? `\nAPPROVED PLAN SUMMARY:\n${input.planSummary.slice(0, 3_000)}` : "",
    input.methodMix ? `\nMETHOD MIX:\n${JSON.stringify(input.methodMix).slice(0, 3_000)}` : "",
    input.audience ? `\nPLANNED AUDIENCE:\n${JSON.stringify(input.audience).slice(0, 2_000)}` : "",
    input.steering ? `\nADDITIONAL STEER FROM THE CLIENT:\n${input.steering.slice(0, 2_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const frame = await deriveJson<RecruitmentFrame>({
    system: FRAME_SYSTEM,
    user,
    validate: isFrame,
  });

  return {
    ...frame,
    personas: frame.personas.slice(0, 6).map((p) => ({
      ...p,
      survey_target: clampInt(p.survey_target, 3, 500, 20),
      focus_group: p.focus_group !== false,
      where_to_look: Array.isArray(p.where_to_look) ? p.where_to_look.slice(0, 5) : [],
    })),
    screening: (frame.screening ?? []).slice(0, 6),
    exclusions: (frame.exclusions ?? []).slice(0, 6),
    derived_at: new Date().toISOString(),
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// ── Candidate research ─────────────────────────────────────────────────────

const CANDIDATE_SYSTEM = `You are a field-research recruiter for a sovereign government programme. You identify REAL, NAMED, publicly identifiable individuals in a named country who match a described persona and could be invited to take part in research.

Hard rules:
- Only people whose name and role are PUBLICLY published — ministry officials, permanent secretaries, statutory board members, association and chamber-of-commerce office holders, named business owners, academics, union and civil-society leaders, named diaspora organisation leads.
- Every person MUST carry at least one https source_url that names them in that role — an official ministry page, an organisation's leadership page, a press release, a registry, a published board list. If you cannot cite the person, DO NOT return them.
- Never invent an email. Return an official published email only if it appears at the source; otherwise null.
- fit_reason: one sentence tying THIS person to THIS persona and this programme's question.
- confidence: "high" when a primary/official source names them in the role right now; "medium" when the source is credible but dated or secondary; "low" when the match is inferred.
- suggested_for: ["survey"], ["focus_group"], or both — senior officeholders usually suit a moderated group; frontline operators usually suit a survey.
- Do not return the same person twice. Do not pad the list to hit a number; returning fewer, sourced people is correct.

Return ONE JSON object: {"candidates":[{"full_name":"","role_title":"","organisation":"","email":null,"fit_reason":"","confidence":"high|medium|low","source_url":"https://...","suggested_for":["survey"]}],"notes":["..."]}`;

function isHttps(u: unknown): u is string {
  return typeof u === "string" && /^https:\/\/[^\s]+\.[^\s]+/i.test(u.trim());
}

const GENERIC_NAME = /^(n\/?a|unknown|tbd|various|multiple|the minister|minister|ceo|director|staff|team|redacted|anonymous)\b/i;

function cleanCandidates(raw: unknown): CandidateRecord[] {
  const list = Array.isArray((raw as { candidates?: unknown })?.candidates)
    ? ((raw as { candidates: unknown[] }).candidates as Array<Record<string, unknown>>)
    : [];
  const out: CandidateRecord[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const name = String(r["full_name"] ?? "").trim();
    if (name.length < 4 || !name.includes(" ") || GENERIC_NAME.test(name)) continue;
    const url = r["source_url"];
    if (!isHttps(url)) continue;
    const key = `${name.toLowerCase()}|${String(r["organisation"] ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const conf = String(r["confidence"] ?? "medium").toLowerCase();
    const forRaw = Array.isArray(r["suggested_for"]) ? (r["suggested_for"] as unknown[]) : [];
    const suggested = forRaw
      .map((s) => String(s).toLowerCase().replace(/[\s-]/g, "_"))
      .filter((s): s is "survey" | "focus_group" => s === "survey" || s === "focus_group");
    const email = typeof r["email"] === "string" && r["email"].includes("@") ? r["email"].trim() : null;
    out.push({
      full_name: name.slice(0, 160),
      role_title: str(r["role_title"], 200),
      organisation: str(r["organisation"], 200),
      email,
      fit_reason: String(r["fit_reason"] ?? "").trim().slice(0, 600) || "Matches the persona profile.",
      confidence: conf === "high" || conf === "low" ? (conf as "high" | "low") : "medium",
      source_url: (url as string).trim(),
      suggested_for: suggested.length ? [...new Set(suggested)] : ["survey"],
    });
  }
  return out;
}

function str(v: unknown, max: number): string | null {
  const t = String(v ?? "").trim();
  return t.length > 0 && t.toLowerCase() !== "null" ? t.slice(0, max) : null;
}

function personaUser(opts: {
  countryName: string;
  persona: RecruitmentPersona;
  programmeTitle: string;
  question: string;
  want: number;
  exclude: string[];
  widen: boolean;
}): string {
  return [
    `COUNTRY: ${opts.countryName}`,
    `PROGRAMME: ${opts.programmeTitle}`,
    `RESEARCH QUESTION: ${opts.question.slice(0, 1_200)}`,
    "",
    `PERSONA: ${opts.persona.label}`,
    `WHO: ${opts.persona.who}`,
    `WHY THEY MATTER: ${opts.persona.why}`,
    opts.persona.sector ? `SECTOR: ${opts.persona.sector}` : "",
    opts.persona.seniority ? `SENIORITY: ${opts.persona.seniority}` : "",
    opts.persona.region ? `REGION: ${opts.persona.region}` : "",
    opts.persona.where_to_look?.length
      ? `WHERE SUCH PEOPLE ARE PUBLICLY LISTED: ${opts.persona.where_to_look.join("; ")}`
      : "",
    "",
    `Return up to ${opts.want} named individuals, each with a source URL.`,
    opts.exclude.length
      ? `ALREADY ON THE LIST — do not return these people again: ${opts.exclude.slice(0, 60).join("; ")}`
      : "",
    opts.widen
      ? "The first pass returned too few. Widen the search: adjacent institutions, regional and parish bodies, former officeholders still active, association committee members, named operators in trade directories and press coverage. Keep the sourcing standard — no citation, no candidate."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * One persona, one deep-research pass (plus one widened redrive when the first
 * pass comes back thin). Never pads: a short slate is reported honestly.
 */
export async function researchPersonaCandidates(opts: {
  countryName: string;
  countryCode: string;
  programmeTitle: string;
  question: string;
  persona: RecruitmentPersona;
  want: number;
  exclude: string[];
  domains?: string[];
}): Promise<PersonaResearchResult> {
  const notes: string[] = [];
  const citations: SonarCitation[] = [];
  const found: CandidateRecord[] = [];
  const seen = new Set<string>(opts.exclude.map((n) => n.toLowerCase()));

  const runPass = async (widen: boolean) => {
    const res = await callSonar({
      model: "sonar-reasoning-pro",
      system: CANDIDATE_SYSTEM,
      user: personaUser({
        countryName: opts.countryName,
        persona: opts.persona,
        programmeTitle: opts.programmeTitle,
        question: opts.question,
        want: Math.max(4, opts.want - found.length),
        exclude: [...seen],
        widen,
      }),
      extraDomains: opts.domains,
      noDomainFilter: true,
      maxTokens: 4_000,
    });
    for (const c of res.citations) {
      if (!citations.some((x) => x.url === c.url)) citations.push(c);
    }
    const parsed = parseSonarJson<unknown>(res.content);
    if (!parsed) {
      notes.push(`${opts.persona.label}: the research pass returned nothing readable.`);
      return;
    }
    for (const cand of cleanCandidates(parsed)) {
      const key = cand.full_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(cand);
    }
    const rawNotes = (parsed as { notes?: unknown }).notes;
    if (Array.isArray(rawNotes)) {
      for (const n of rawNotes.slice(0, 3)) notes.push(String(n).slice(0, 300));
    }
  };

  try {
    await runPass(false);
  } catch (e) {
    notes.push(`${opts.persona.label}: first pass failed — ${(e as Error).message.slice(0, 200)}`);
  }

  if (found.length < Math.min(opts.want, 6)) {
    try {
      await runPass(true);
    } catch (e) {
      notes.push(`${opts.persona.label}: redrive failed — ${(e as Error).message.slice(0, 200)}`);
    }
  }

  if (found.length === 0) {
    notes.push(
      `${opts.persona.label}: no publicly sourced individuals could be found. Add them by hand, or widen the persona.`,
    );
  } else if (found.length < opts.want) {
    notes.push(
      `${opts.persona.label}: thin coverage — ${found.length} of ${opts.want} sourced. The rest will need hand recruitment.`,
    );
  }

  return { persona: opts.persona.label, candidates: found, citations, notes };
}

// ── Focus-group composition ────────────────────────────────────────────────

export interface GroupProposal {
  name: string;
  rationale: string;
  members: string[]; // contact ids
}

export async function composeGroups(input: {
  programmeTitle: string;
  question: string;
  people: Array<{ id: string; name: string; role: string | null; org: string | null; persona: string | null }>;
  groupSize: number;
}): Promise<GroupProposal[]> {
  if (input.people.length === 0) return [];

  const validIds = new Set(input.people.map((p) => p.id));
  const system = `You compose focus groups for government research. A good group is small (6-8), mixes perspectives that will productively disagree, and never seats a person alongside someone whose presence would silence them (a permanent secretary in a group of their own junior staff). Give each group a specific name drawn from what it will discuss, and one sentence of composition rationale. Return ONE JSON object: {"groups":[{"name":"","rationale":"","members":["<id>"]}]}. Use only the ids provided.`;

  const user = [
    `PROGRAMME: ${input.programmeTitle}`,
    `QUESTION: ${input.question.slice(0, 800)}`,
    `TARGET GROUP SIZE: ${input.groupSize}`,
    "",
    "PEOPLE (id · name · role · organisation · persona):",
    ...input.people.map(
      (p) => `${p.id} · ${p.name} · ${p.role ?? "—"} · ${p.org ?? "—"} · ${p.persona ?? "—"}`,
    ),
  ].join("\n");

  const res = await deriveJson<{ groups: GroupProposal[] }>({
    system,
    user,
    validate: (v): v is { groups: GroupProposal[] } =>
      !!v &&
      typeof v === "object" &&
      Array.isArray((v as { groups?: unknown }).groups) &&
      (v as { groups: Array<{ members?: unknown }> }).groups.every((g) => Array.isArray(g?.members)),
  });

  return res.groups
    .map((g, i) => ({
      name: (g.name ?? "").trim() || `Group ${i + 1}`,
      rationale: (g.rationale ?? "").trim(),
      members: [...new Set((g.members ?? []).filter((id) => validIds.has(id)))],
    }))
    .filter((g) => g.members.length >= 2)
    .slice(0, 4);
}
