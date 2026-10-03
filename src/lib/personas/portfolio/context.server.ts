// Chamber 07 · Ministers track — the grounding pack. Server-only.
//
// The lines a persona set may be written from, each naming its source row:
//
//   office.*    real office holders for the portfolio (government_offices),
//               across every onboarded country for a regional set, or one
//               country for an overlay. For the Prime Minister: the head of
//               government, and the portfolios that person holds concurrently.
//   ministry.*  mandates and programmes of the ministries mapped to the
//               portfolio (ministries.portfolio_code → ministry_profiles).
//   sector.*    the sector briefs for the portfolio's default sectors.
//   research.*  a cited research pass on the career patterns, reforms and
//               crises of people who have held this office in CARICOM and
//               comparable small island states (Perplexity; skipped, with a
//               gap noted, when the key is not configured).
//
// It also returns the real office holders, which the Quality Check uses to
// keep every persona a composite rather than a portrait.

import { clipText as clip, contextLine as line, sha256Hex } from "@/lib/egov/context.server";
import { db, type AnyClient } from "@/lib/syndication/db";

import { REGIONAL, type ContextLine, type PortfolioRow } from "./db";
import type { RealHolder } from "./qa";

export interface PortfolioPack {
  lines: ContextLine[];
  hash: string;
  gaps: string[];
  real: RealHolder[];
  countries: number;
}

const MAX_COUNTRIES_FOR_SECTORS = 8;

async function countryNames(sb: AnyClient): Promise<Map<string, string>> {
  const { data } = await db(sb).from("countries").select("code,name");
  return new Map(
    ((data ?? []) as Array<{ code: string; name: string }>).map((c) => [c.code, c.name]),
  );
}

async function mappedMinistries(sb: AnyClient, p: PortfolioRow, scope: string) {
  let q = db(sb)
    .from("ministries")
    .select("id,country_code,slug,name,portfolio_code,secondary_portfolio_codes")
    .or(`portfolio_code.eq.${p.code},secondary_portfolio_codes.cs.{${p.code}}`);
  if (scope !== REGIONAL) q = q.eq("country_code", scope);
  const { data, error } = await q.limit(200);
  if (error) return [];
  return (data ?? []) as Array<{
    id: string;
    country_code: string;
    slug: string;
    name: string;
    portfolio_code: string | null;
    secondary_portfolio_codes: string[];
  }>;
}

async function readOffices(
  sb: AnyClient,
  p: PortfolioRow,
  scope: string,
  names: Map<string, string>,
  ministries: Array<{ country_code: string; slug: string; name: string }>,
): Promise<{ lines: ContextLine[]; real: RealHolder[] }> {
  const c = db(sb);
  let q = c
    .from("government_offices")
    .select(
      "id,country_code,office_key,title,holder_name,ministry_slug,portfolio,party,appointed_on,bio,status",
    )
    .neq("status", "retired");
  if (scope !== REGIONAL) q = q.eq("country_code", scope);
  const isPm = p.kind === "head_of_government";
  const isOpp = p.kind === "opposition";
  if (isOpp) {
    q = q.eq("office_key", "leader_of_opposition");
  } else if (isPm) {
    q = q.in("office_key", ["head_of_government", "deputy_head_of_government", "cabinet_minister"]);
  } else {
    q = q.in("office_key", ["cabinet_minister", "minister_of_state"]);
  }
  const { data } = await q.order("precedence").limit(600);
  const rows = (data ?? []) as Array<{
    id: string;
    country_code: string;
    office_key: string;
    title: string;
    holder_name: string | null;
    ministry_slug: string | null;
    portfolio: string;
    party: string | null;
    appointed_on: string | null;
    bio: string | null;
  }>;

  const slugs = new Set(ministries.map((m) => `${m.country_code}/${m.slug}`));
  // Postgres word boundaries (\m, \M) are \b in JavaScript.
  const pattern = p.name_pattern ? new RegExp(p.name_pattern.replace(/\\[mM]/g, "\\b"), "i") : null;
  const lines: ContextLine[] = [];
  const real: RealHolder[] = [];
  const country = (cc: string) => names.get(cc) ?? cc;

  const relevant = rows.filter((r) =>
    isOpp
      ? r.office_key === "leader_of_opposition"
      : isPm
        ? r.office_key === "head_of_government"
        : (r.ministry_slug && slugs.has(`${r.country_code}/${r.ministry_slug}`)) ||
          (!!pattern && pattern.test(`${r.title} ${r.portfolio}`)),
  );

  relevant.forEach((r, i) => {
    if (r.holder_name)
      real.push({ name: r.holder_name, bio: r.bio ?? "", country: country(r.country_code) });
    // Concurrent portfolios: other Cabinet offices held by the same person.
    const also =
      isPm && r.holder_name
        ? rows
            .filter(
              (o) =>
                o.id !== r.id &&
                o.country_code === r.country_code &&
                o.holder_name === r.holder_name,
            )
            .map((o) => o.portfolio || o.title)
            .filter(Boolean)
        : [];
    const bits = [
      `${r.title} of ${country(r.country_code)}`,
      r.party ? `party: ${r.party}` : "",
      r.appointed_on ? `appointed ${r.appointed_on}` : "",
      also.length ? `also holds: ${also.join("; ")}` : "",
      r.bio ? `career: ${clip(r.bio, 420)}` : "",
    ].filter(Boolean);
    lines.push(
      line(
        `office.${r.country_code.toLowerCase()}.${i + 1}`,
        bits.join(" — "),
        "corpus_row",
        `government_offices:${r.id}`,
        `${r.title} — ${country(r.country_code)}`,
      ),
    );
  });
  return { lines: lines.slice(0, 60), real };
}

async function readMinistryProfiles(
  sb: AnyClient,
  ministries: Array<{ country_code: string; slug: string; name: string }>,
  names: Map<string, string>,
): Promise<ContextLine[]> {
  if (!ministries.length) return [];
  const byCountry = new Map<string, string[]>();
  for (const m of ministries) {
    const l = byCountry.get(m.country_code) ?? [];
    l.push(m.slug);
    byCountry.set(m.country_code, l);
  }
  const out: ContextLine[] = [];
  for (const [cc, slugs] of byCountry) {
    const { data } = await db(sb)
      .from("ministry_profiles")
      .select("id,ministry_slug,mandate,programmes")
      .eq("country_code", cc)
      .in("ministry_slug", slugs);
    for (const p of (data ?? []) as Array<{
      id: string;
      ministry_slug: string;
      mandate: string | null;
      programmes: unknown;
    }>) {
      const mName =
        ministries.find((m) => m.country_code === cc && m.slug === p.ministry_slug)?.name ??
        p.ministry_slug;
      const progs = Array.isArray(p.programmes)
        ? (p.programmes as Array<Record<string, unknown> | string>)
            .map((x) => (typeof x === "string" ? x : String(x.name ?? x.title ?? "")))
            .filter(Boolean)
            .slice(0, 6)
        : [];
      const text = [
        `${mName} (${names.get(cc) ?? cc})`,
        p.mandate ? `mandate: ${clip(p.mandate, 380)}` : "",
        progs.length ? `programmes: ${clip(progs.join("; "), 300)}` : "",
      ]
        .filter(Boolean)
        .join(" — ");
      out.push(
        line(
          `ministry.${cc.toLowerCase()}.${p.ministry_slug}`,
          text,
          "corpus_row",
          `ministry_profiles:${p.id}`,
          `${mName} — ${names.get(cc) ?? cc}`,
        ),
      );
    }
    if (out.length >= 40) break;
  }
  return out;
}

async function readSectorBriefs(
  sb: AnyClient,
  p: PortfolioRow,
  scope: string,
  names: Map<string, string>,
): Promise<ContextLine[]> {
  if (!p.default_sector_codes.length) return [];
  let q = db(sb)
    .from("sector_dossier_briefs")
    .select("country_code,sector_code,brief")
    .in("sector_code", p.default_sector_codes);
  if (scope !== REGIONAL) q = q.eq("country_code", scope);
  const { data } = await q.limit(MAX_COUNTRIES_FOR_SECTORS * p.default_sector_codes.length);
  return (
    (data ?? []) as Array<{
      country_code: string;
      sector_code: string;
      brief: Record<string, unknown> | null;
    }>
  )
    .filter((r) => r.brief && (r.brief.headline || r.brief.executive))
    .map((r) =>
      line(
        `sector.${r.country_code.toLowerCase()}.${r.sector_code}`,
        `${names.get(r.country_code) ?? r.country_code}, ${r.sector_code}: ${clip(r.brief!.headline ?? "", 200)} ${clip(r.brief!.executive ?? "", 520)}`.trim(),
        "corpus_row",
        `sector_dossier_briefs:${r.country_code}/${r.sector_code}`,
        `Sector brief — ${r.sector_code} (${names.get(r.country_code) ?? r.country_code})`,
      ),
    );
}

const ResearchJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          source_url: { type: "string" },
        },
        required: ["text", "source_url"],
      },
    },
  },
  required: ["findings"],
};

async function readResearch(
  p: PortfolioRow,
  scope: string,
  names: Map<string, string>,
): Promise<{ lines: ContextLine[]; gap: string | null }> {
  if (!process.env.PERPLEXITY_API_KEY)
    return { lines: [], gap: "Research pass skipped: PERPLEXITY_API_KEY is not configured." };
  const where =
    scope === REGIONAL
      ? "CARICOM and OECS member states, and comparable small island developing states"
      : (names.get(scope) ?? scope);
  const office =
    p.kind === "head_of_government"
      ? "Prime Minister (head of government)"
      : `minister responsible for ${p.label}`;
  const { callSonar, parseSonarJson } = await import("@/lib/country-onboarding/perplexity.server");
  try {
    const r = await callSonar({
      model: "sonar-pro",
      system:
        "You are a research assistant on Caribbean public administration. Report only what your sources say. Each finding is one factual sentence or two, with the URL of the source it came from. No opinion, no invention.",
      user: `Research the people who have served as ${office} in ${where} since about 2000. Report 12 to 20 findings on: the routes people took to the office (prior careers, education, party roles); what typically shaped their tenure (crises, debt, hurricanes, industry shocks, scandals); reforms that were attempted and whether they lasted; the decisions that defined good and poor performance in the role; and the skills observers and evaluations (IMF, World Bank, CDB, IDB, ECLAC, academic studies, reputable press) associate with success. Return JSON: {"findings":[{"text":"…","source_url":"https://…"}]}.`,
      responseSchema: ResearchJsonSchema,
      maxTokens: 3500,
      noDomainFilter: true,
    });
    const parsed = parseSonarJson<{ findings?: Array<{ text?: string; source_url?: string }> }>(
      r.content,
    );
    const urls = new Set(r.citations.map((c) => c.url));
    const findings = (parsed?.findings ?? []).filter(
      (f) => f.text && f.source_url && /^https:\/\//.test(f.source_url),
    );
    const lines = findings.slice(0, 20).map((f, i) => {
      const title = r.citations.find((c) => c.url === f.source_url)?.title;
      return line(
        `research.${i + 1}`,
        clip(f.text, 420),
        "research_url",
        f.source_url!,
        title ||
          new URL(f.source_url!).hostname + (urls.has(f.source_url!) ? "" : " (model-cited)"),
      );
    });
    return {
      lines,
      gap: lines.length ? null : "The research pass returned no usable cited findings.",
    };
  } catch (e) {
    return { lines: [], gap: `Research pass failed: ${(e as Error).message.slice(0, 160)}` };
  }
}

export async function buildPortfolioPack(
  sb: AnyClient,
  p: PortfolioRow,
  scope: string,
  opts: { research?: boolean } = {},
): Promise<PortfolioPack> {
  const names = await countryNames(sb);
  const ministries = await mappedMinistries(sb, p, scope);
  const [offices, profiles, sectors, research] = await Promise.all([
    readOffices(sb, p, scope, names, ministries),
    readMinistryProfiles(sb, ministries, names),
    readSectorBriefs(sb, p, scope, names),
    opts.research === false
      ? Promise.resolve({ lines: [] as ContextLine[], gap: null })
      : readResearch(p, scope, names),
  ]);

  const head: ContextLine[] = [
    line(
      "portfolio.office",
      `${p.label}: ${p.description}`,
      "corpus_row",
      `ministry_portfolios:${p.code}`,
      `Portfolio — ${p.label}`,
    ),
  ];
  const lines = [...head, ...offices.lines, ...profiles, ...sectors, ...research.lines];
  const gaps: string[] = [];
  if (!offices.lines.length)
    gaps.push(
      p.kind === "opposition"
        ? "No Leader of the Opposition in the corpus yet. Back-fill the government record (Government page) for the onboarded countries."
        : p.kind === "head_of_government"
          ? "No head-of-government record in the corpus yet. Back-fill the government record (Government page) for the onboarded countries."
          : "No Cabinet office in the corpus is mapped to this portfolio yet. Map the ministries to portfolios, or back-fill the government record.",
    );
  if (!profiles.length && p.kind === "ministry")
    gaps.push("No ministry profile mapped to this portfolio.");
  if (research.gap) gaps.push(research.gap);

  const countries = new Set(
    [...offices.lines, ...profiles].map((l) => l.key.split(".")[1]).filter(Boolean),
  ).size;
  const hash = await sha256Hex(lines.map((l) => `${l.key}|${l.text}`).join("\n"));
  return { lines, hash, gaps, real: offices.real, countries };
}

export function packBlock(lines: ContextLine[]): string {
  return `CONTEXT (key | text | source). Ground the personas in these lines and cite them by key.\n${lines
    .map((l) => `${l.key} | ${l.text} | ${l.source.label}`)
    .join("\n")}`;
}
