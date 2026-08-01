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

// ── Candidate research: a bounded, resumable agent ─────────────────────────
//
// One long reasoning call does not survive an edge request. The recruiter is
// therefore split into short passes, each well inside the request budget and
// each persisting what it found before it returns:
//
//   Pass A — locate the registries where such people are publicly named.
//   Pass B — extract named individuals from a small batch of those registries.
//   Pass W — one widened sweep when the slate is still thin.

const CANDIDATE_SYSTEM = `You are a field-research recruiter for a sovereign government programme. You identify REAL, NAMED, publicly identifiable individuals in a named country who match a described persona and could be invited to take part in research.

Hard rules:
- Only people whose name and role are PUBLICLY published — ministry officials, permanent secretaries, statutory board members, association and chamber-of-commerce office holders, named business owners, academics, union and civil-society leaders, named diaspora organisation leads.
- Every person MUST carry at least one https source_url that names them in that role — an official ministry page, an organisation's leadership page, a press release, a registry, a published board list. If you cannot cite the person, DO NOT return them.
- Never invent an email. Return an official published email only if it appears at the source; otherwise null.
- fit_reason: one sentence tying THIS person to THIS persona and this programme's question.
- confidence: "high" when a primary/official source names them in the role right now; "medium" when the source is credible but dated or secondary; "low" when the match is inferred.
- suggested_for: ["survey"], ["focus_group"], or both — senior officeholders usually suit a moderated group; frontline operators usually suit a survey.
- Do not return the same person twice. Do not pad the list to hit a number; returning fewer, sourced people is correct.
- Return ONLY the JSON object. No preamble, no reasoning, no code fences.

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

export interface RegistryLead {
  url: string;
  what: string;
}

const REGISTRY_SYSTEM = `You locate the public pages on which real people matching a described persona are NAMED.

Return web pages that publish actual names and roles: ministry leadership pages, permanent-secretary listings, statutory board pages, association and chamber-of-commerce committee pages, professional registries, university faculty pages, published board lists, named press coverage.

Rules:
- Only pages that plausibly NAME individuals. A homepage or a policy PDF is useless — go to the "our team", "leadership", "board", "members", "executive" page.
- Prefer pages specific to the named country.
- 4 to 8 leads. Each carries the https URL and one short line saying who is named there.
- Return ONLY the JSON object. No preamble, no reasoning, no code fences.

Return ONE JSON object: {"registries":[{"url":"https://...","what":"..."}],"notes":["..."]}`;

/** Pass A — find the pages that name people for this persona. Cheap and fast. */
export async function findPersonaRegistries(opts: {
  countryName: string;
  programmeTitle: string;
  persona: RecruitmentPersona;
}): Promise<{ registries: RegistryLead[]; citations: SonarCitation[]; notes: string[] }> {
  const user = [
    `COUNTRY: ${opts.countryName}`,
    `PROGRAMME: ${opts.programmeTitle}`,
    `PERSONA: ${opts.persona.label}`,
    `WHO: ${opts.persona.who}`,
    opts.persona.sector ? `SECTOR: ${opts.persona.sector}` : "",
    opts.persona.seniority ? `SENIORITY: ${opts.persona.seniority}` : "",
    opts.persona.region ? `REGION: ${opts.persona.region}` : "",
    opts.persona.where_to_look?.length
      ? `START HERE: ${opts.persona.where_to_look.join("; ")}`
      : "",
    "",
    "Find the public pages on which such people are named.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await callSonar({
    model: "sonar-pro",
    system: REGISTRY_SYSTEM,
    user,
    noDomainFilter: true,
    maxTokens: 1_400,
  });

  const parsed = parseSonarJson<{ registries?: unknown; notes?: unknown }>(res.content);
  const registries: RegistryLead[] = [];
  const seen = new Set<string>();
  const raw = Array.isArray(parsed?.registries) ? (parsed.registries as unknown[]) : [];
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    const url = typeof o["url"] === "string" ? o["url"].trim() : "";
    if (!isHttps(url) || seen.has(url)) continue;
    seen.add(url);
    registries.push({ url, what: String(o["what"] ?? "").slice(0, 200) });
  }
  // The searcher's own citations are registries too, when the model was terse.
  for (const c of res.citations) {
    if (registries.length >= 10) break;
    if (isHttps(c.url) && !seen.has(c.url)) {
      seen.add(c.url);
      registries.push({ url: c.url, what: c.title ?? "Cited source" });
    }
  }

  const notes = Array.isArray(parsed?.notes)
    ? (parsed.notes as unknown[]).slice(0, 3).map((n) => String(n).slice(0, 300))
    : [];

  return { registries: registries.slice(0, 10), citations: res.citations, notes };
}

function personaBlock(persona: RecruitmentPersona): string {
  return [
    `PERSONA: ${persona.label}`,
    `WHO: ${persona.who}`,
    `WHY THEY MATTER: ${persona.why}`,
    persona.sector ? `SECTOR: ${persona.sector}` : "",
    persona.seniority ? `SENIORITY: ${persona.seniority}` : "",
    persona.region ? `REGION: ${persona.region}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Pass B — read a small batch of registries and return named people. */
export async function extractCandidatesFromRegistries(opts: {
  countryName: string;
  programmeTitle: string;
  question: string;
  persona: RecruitmentPersona;
  registries: RegistryLead[];
  want: number;
  exclude: string[];
}): Promise<{ candidates: CandidateRecord[]; citations: SonarCitation[]; notes: string[] }> {
  const user = [
    `COUNTRY: ${opts.countryName}`,
    `PROGRAMME: ${opts.programmeTitle}`,
    `RESEARCH QUESTION: ${opts.question.slice(0, 900)}`,
    "",
    personaBlock(opts.persona),
    "",
    "READ THESE PAGES AND NAME THE PEOPLE ON THEM:",
    ...opts.registries.map((r) => `- ${r.url}${r.what ? ` — ${r.what}` : ""}`),
    "",
    `Return up to ${opts.want} named individuals who match the persona, each with the URL that names them.`,
    opts.exclude.length
      ? `ALREADY ON THE LIST — do not return these people again: ${opts.exclude.slice(0, 60).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await callSonar({
    model: "sonar-pro",
    system: CANDIDATE_SYSTEM,
    user,
    noDomainFilter: true,
    maxTokens: 2_600,
  });

  return readCandidatePass(res, opts.persona.label);
}

/** Pass W — one adjacent-institution sweep when the slate is thin. */
export async function widenCandidateSweep(opts: {
  countryName: string;
  programmeTitle: string;
  question: string;
  persona: RecruitmentPersona;
  want: number;
  exclude: string[];
}): Promise<{ candidates: CandidateRecord[]; citations: SonarCitation[]; notes: string[] }> {
  const user = [
    `COUNTRY: ${opts.countryName}`,
    `PROGRAMME: ${opts.programmeTitle}`,
    `RESEARCH QUESTION: ${opts.question.slice(0, 900)}`,
    "",
    personaBlock(opts.persona),
    "",
    "The registry pass came back thin. Widen the search: adjacent ministries and agencies, regional and parish bodies, association committee members, former officeholders still active, named operators in trade directories, named people in recent press coverage. Keep the sourcing standard — no citation, no candidate.",
    `Return up to ${opts.want} further named individuals.`,
    opts.exclude.length
      ? `ALREADY ON THE LIST — do not return these people again: ${opts.exclude.slice(0, 60).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await callSonar({
    model: "sonar-pro",
    system: CANDIDATE_SYSTEM,
    user,
    noDomainFilter: true,
    maxTokens: 2_600,
  });

  return readCandidatePass(res, opts.persona.label);
}

function readCandidatePass(
  res: { content: string; citations: SonarCitation[] },
  personaLabel: string,
): { candidates: CandidateRecord[]; citations: SonarCitation[]; notes: string[] } {
  const notes: string[] = [];
  const parsed = parseSonarJson<unknown>(res.content);
  if (!parsed) {
    notes.push(`${personaLabel}: the pass returned nothing readable.`);
    return { candidates: [], citations: res.citations, notes };
  }
  const rawNotes = (parsed as { notes?: unknown }).notes;
  if (Array.isArray(rawNotes)) {
    for (const n of rawNotes.slice(0, 2)) notes.push(String(n).slice(0, 300));
  }
  return { candidates: cleanCandidates(parsed), citations: res.citations, notes };
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
