// Server-only. AI research pipeline for the political-parties + ruling-party
// + manifesto backfill routine.
//
// Three passes per country, each Perplexity `sonar-reasoning-pro` grounded to
// the country's authorized gov/portal/parliament domains + trusted globals
// (IPU, IFES, Wikipedia). Every returned row requires ≥1 https source_url.
//
//   1) Parties pass    — enumerate active parties (name, abbreviation,
//                        leader, ideology, seats, last election result).
//   2) Ruling pass     — flag which party (or coalition) is in power.
//   3) Manifesto pass  — find the ruling lead party's latest published
//                        manifesto / programme of government + fetch it into
//                        the corpus so Counsel/Ask can quote it.
//
// The orchestrator (party-backfill.functions.ts) calls these three and
// persists the results.

import { callSonar, parseSonarJson, fetchCitationText, type SonarCitation } from "./perplexity.server";
import { contextDomains, type CountryContext } from "./country-context.server";
import { recordCorpusReadOutcome } from "@/lib/corpus/gateway.server";

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export type PartyRecord = {
  name: string;
  abbreviation: string | null;
  leader_name: string | null;
  leader_role: string | null;
  ideology: string | null;
  founded_year: number | null;
  seats_current: number | null;
  seats_total: number | null;
  vote_share_pct: number | null;
  last_election_date: string | null;
  source_urls: string[];
};

export type PartiesPassResult = {
  parties: PartyRecord[];
  citations: SonarCitation[];
  notes: string[];
};

export type RulingRecord = {
  party_name: string;
  coalition_role: "lead" | "partner";
};

export type RulingPassResult = {
  election_cycle: string | null;
  ruling: RulingRecord[];
  citations: SonarCitation[];
  notes: string[];
};

export type ManifestoPledge = {
  theme: string;
  pledge: string;
  sector_code?: string | null;
  kpi_hint?: string | null;
};

export type ManifestoPassResult = {
  election_cycle: string | null;
  title: string | null;
  summary: string;
  themes: string[];
  pledges: ManifestoPledge[];
  source_url: string | null;
  source_text: string | null;
  citations: SonarCitation[];
  notes: string[];
};

// ---------------------------------------------------------------------------
// Shared system prompts
// ---------------------------------------------------------------------------

const PARTIES_SYSTEM =
  "You are a comparative-politics analyst. Enumerate every currently ACTIVE political party in the named country. For each party return: name (official), abbreviation, current leader's full name + role, brief ideology tag (e.g. social democratic, centre-right, nationalist), founded_year, seats_current in the primary legislative chamber, seats_total in that chamber, vote_share_pct from the most recent general election, last_election_date (YYYY-MM-DD or YYYY). Every party MUST include at least one https source_url from the electoral commission, parliament, IPU, IFES, or the party's own official site — reject anything you cannot source. Return ONE JSON object with a `parties` array. Never guess numbers; use null when a figure isn't sourced.";

const RULING_SYSTEM =
  "You identify the sitting government of a country. Return ONE JSON object naming the party (or coalition) that CURRENTLY holds executive power, plus the election cycle that put them there (e.g. \"2024\"). For each entry: party_name and coalition_role ('lead' for the head-of-government's party, 'partner' for other coalition members). Cite the primary source URL that names this arrangement. If the head of government is independent or non-partisan, return an empty array. Never guess.";

const MANIFESTO_SYSTEM =
  "You are a political-programme researcher. Locate the OFFICIAL published manifesto / programme of government for the named ruling party's most recent successful election. Return ONE JSON object: election_cycle, title (as published), summary (200-400 words), themes (5-10 short labels), pledges (12-25 concrete pledges each with theme and pledge; sector_code and kpi_hint when obvious), source_url (direct https link to the manifesto PDF or landing page on the party's site, election commission, or a recognised archive). Reject anything you cannot cite — return source_url:null when there is no primary published document.";

// ---------------------------------------------------------------------------
// JSON schemas
// ---------------------------------------------------------------------------

const PartiesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    parties: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          abbreviation: { type: ["string", "null"] },
          leader_name: { type: ["string", "null"] },
          leader_role: { type: ["string", "null"] },
          ideology: { type: ["string", "null"] },
          founded_year: { type: ["integer", "null"] },
          seats_current: { type: ["integer", "null"] },
          seats_total: { type: ["integer", "null"] },
          vote_share_pct: { type: ["number", "null"] },
          last_election_date: { type: ["string", "null"] },
          source_urls: { type: "array", items: { type: "string" } },
        },
        required: ["name", "source_urls"],
      },
    },
  },
  required: ["parties"],
} as const;

const RulingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    election_cycle: { type: ["string", "null"] },
    ruling: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          party_name: { type: "string" },
          coalition_role: { type: "string", enum: ["lead", "partner"] },
        },
        required: ["party_name", "coalition_role"],
      },
    },
  },
  required: ["ruling"],
} as const;

const ManifestoSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    election_cycle: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    summary: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    pledges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          theme: { type: "string" },
          pledge: { type: "string" },
          sector_code: { type: ["string", "null"] },
          kpi_hint: { type: ["string", "null"] },
        },
        required: ["theme", "pledge"],
      },
    },
    source_url: { type: ["string", "null"] },
  },
  required: ["summary", "themes", "pledges"],
} as const;

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

export async function partiesPass(params: {
  countryCode: string;
  countryName: string;
  ctx: CountryContext;
  actor?: string;
}): Promise<PartiesPassResult> {
  const started = Date.now();
  try {
    const res = await callSonar({
      model: "sonar-reasoning-pro",
      system: PARTIES_SYSTEM,
      user: `Country: ${params.countryName}. List every active registered or parliament-represented political party. Return JSON.`,
      responseSchema: PartiesSchema as unknown as Record<string, unknown>,
      countryTld: params.ctx.tld ?? undefined,
      extraDomains: [
        ...contextDomains(params.ctx),
        "ipu.org",
        "ifes.org",
        "electionguide.org",
        "wikipedia.org",
      ],
      recency: "year",
    });
    const parsed = parseSonarJson<{ parties?: any[] }>(res.content) ?? { parties: [] };
    const parties: PartyRecord[] = ((parsed.parties ?? []) as any[])
      .map(normalizeParty)
      .filter((p): p is PartyRecord => !!p && !!p.name && p.source_urls.length > 0);

    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `parties:enumerate`,
      outcome: parties.length ? "hit" : "empty",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier: "targeted_web",
      notes: { parties: parties.length, citations: res.citations.length },
    });

    return {
      parties,
      citations: res.citations,
      notes: parties.length ? [] : ["parties pass returned no sourced rows"],
    };
  } catch (err) {
    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `parties:enumerate`,
      outcome: "error",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier: "targeted_web",
      notes: { error: (err as Error).message.slice(0, 240) },
    });
    return { parties: [], citations: [], notes: [(err as Error).message] };
  }
}

export async function rulingPass(params: {
  countryCode: string;
  countryName: string;
  ctx: CountryContext;
  parties: PartyRecord[];
  actor?: string;
}): Promise<RulingPassResult> {
  const started = Date.now();
  try {
    const partiesHint = params.parties
      .slice(0, 20)
      .map((p) => `- ${p.name}${p.abbreviation ? ` (${p.abbreviation})` : ""}`)
      .join("\n");
    const res = await callSonar({
      model: "sonar-reasoning-pro",
      system: RULING_SYSTEM,
      user: `Country: ${params.countryName}.\n\nActive parties (from prior pass):\n${partiesHint || "(none provided)"}\n\nWhich party or coalition currently holds executive power, and what election cycle put them there? Return JSON.`,
      responseSchema: RulingSchema as unknown as Record<string, unknown>,
      countryTld: params.ctx.tld ?? undefined,
      extraDomains: [...contextDomains(params.ctx), "ipu.org", "wikipedia.org"],
      recency: "year",
    });
    const parsed = parseSonarJson<{ election_cycle?: string | null; ruling?: any[] }>(res.content) ?? {};
    const ruling: RulingRecord[] = ((parsed.ruling ?? []) as any[])
      .map((r): RulingRecord => ({
        party_name: String(r?.party_name ?? "").trim(),
        coalition_role: r?.coalition_role === "partner" ? "partner" : "lead",
      }))
      .filter((r) => r.party_name.length > 0);

    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `parties:ruling`,
      outcome: ruling.length ? "hit" : "empty",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier: "targeted_web",
      notes: { ruling: ruling.length, cycle: parsed.election_cycle ?? null },
    });

    return {
      election_cycle: parsed.election_cycle ?? null,
      ruling,
      citations: res.citations,
      notes: ruling.length ? [] : ["ruling pass returned no rows"],
    };
  } catch (err) {
    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `parties:ruling`,
      outcome: "error",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier: "targeted_web",
      notes: { error: (err as Error).message.slice(0, 240) },
    });
    return { election_cycle: null, ruling: [], citations: [], notes: [(err as Error).message] };
  }
}

export async function manifestoPass(params: {
  countryCode: string;
  countryName: string;
  ctx: CountryContext;
  rulingPartyName: string;
  electionCycle: string | null;
  actor?: string;
}): Promise<ManifestoPassResult> {
  const started = Date.now();
  try {
    const cycleHint = params.electionCycle ? ` (${params.electionCycle} election cycle)` : "";
    const res = await callSonar({
      model: "sonar-reasoning-pro",
      system: MANIFESTO_SYSTEM,
      user: `Country: ${params.countryName}. Ruling party: ${params.rulingPartyName}${cycleHint}.\n\nFind and summarise the official published manifesto or programme of government the party ran on. Return JSON with a direct https source_url to the primary document.`,
      responseSchema: ManifestoSchema as unknown as Record<string, unknown>,
      countryTld: params.ctx.tld ?? undefined,
      extraDomains: [...contextDomains(params.ctx), "wikipedia.org", "manifesto-project.wzb.eu"],
      recency: "year",
    });
    const parsed = parseSonarJson<any>(res.content) ?? {};
    const source_url = typeof parsed.source_url === "string" && /^https?:\/\//.test(parsed.source_url)
      ? parsed.source_url
      : null;

    // Best-effort fetch of the manifesto body so it can be chunked into the
    // corpus. Never blocks the pipeline.
    const source_text = source_url ? await fetchCitationText(source_url, 40_000) : null;

    const result: ManifestoPassResult = {
      election_cycle: parsed.election_cycle ?? params.electionCycle ?? null,
      title: typeof parsed.title === "string" ? parsed.title.trim() : null,
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      themes: Array.isArray(parsed.themes) ? parsed.themes.map(String).filter(Boolean) : [],
      pledges: Array.isArray(parsed.pledges)
        ? (parsed.pledges as any[])
            .map((p) => ({
              theme: String(p?.theme ?? "").trim(),
              pledge: String(p?.pledge ?? "").trim(),
              sector_code: p?.sector_code ? String(p.sector_code) : null,
              kpi_hint: p?.kpi_hint ? String(p.kpi_hint) : null,
            }))
            .filter((p) => p.theme && p.pledge)
        : [],
      source_url,
      source_text: source_text && source_text.length > 200 ? source_text : null,
      citations: res.citations,
      notes: [],
    };

    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `parties:manifesto:${params.rulingPartyName}`,
      outcome: result.source_url ? "hit" : "empty",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier: "targeted_web",
      notes: {
        pledges: result.pledges.length,
        has_text: !!result.source_text,
      },
    });

    return result;
  } catch (err) {
    await recordCorpusReadOutcome({
      countryCode: params.countryCode,
      domain: "ministry",
      key: `parties:manifesto:${params.rulingPartyName}`,
      outcome: "error",
      latencyMs: Date.now() - started,
      actor: params.actor,
      tier: "targeted_web",
      notes: { error: (err as Error).message.slice(0, 240) },
    });
    return {
      election_cycle: params.electionCycle ?? null,
      title: null,
      summary: "",
      themes: [],
      pledges: [],
      source_url: null,
      source_text: null,
      citations: [],
      notes: [(err as Error).message],
    };
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function normalizeParty(raw: any): PartyRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  const source_urls = Array.isArray(raw.source_urls)
    ? raw.source_urls.map(String).filter((u: string) => /^https?:\/\//.test(u))
    : [];
  return {
    name,
    abbreviation: raw.abbreviation ? String(raw.abbreviation).trim() : null,
    leader_name: raw.leader_name ? String(raw.leader_name).trim() : null,
    leader_role: raw.leader_role ? String(raw.leader_role).trim() : null,
    ideology: raw.ideology ? String(raw.ideology).trim() : null,
    founded_year: Number.isFinite(raw.founded_year) ? Number(raw.founded_year) : null,
    seats_current: Number.isFinite(raw.seats_current) ? Number(raw.seats_current) : null,
    seats_total: Number.isFinite(raw.seats_total) ? Number(raw.seats_total) : null,
    vote_share_pct: Number.isFinite(raw.vote_share_pct) ? Number(raw.vote_share_pct) : null,
    last_election_date: raw.last_election_date ? String(raw.last_election_date) : null,
    source_urls,
  };
}

/** Loose name compare tolerant of accents, punctuation, "the" prefixes. */
export function partyNameMatches(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/\bparty\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
