// @domain marketing
// @tables countries,country_kpis,country_sectors,sectors,commitments,decisions,compact_status_updates,compact_deliverables,mandate_compacts,investment_projects,government_offices,statutory_bodies,sector_priorities,sector_plans,egov_prds
// @ui src/components/brief/FactRail.tsx
//
// Country facts for the public Decision Brief. Server-only. Reads through the
// admin client under an explicit allow-list: only figures that are public by
// construction (graded macro figures, counts of approved / verified / public
// rows, standards coverage). Never a draft, never a name, never a row body.
//
// Each fact carries a source and a grade, and where possible a value for the
// same figure across the region, so the brief can say "two months slower than
// the OECS median". Results are cached for an hour per country.

import type { PublicInput } from "./model";

export type FactGrade = "A" | "B" | "C" | "assumption";

export interface Fact {
  key: string;
  label: string;
  /** Display string, formatted for the tile. */
  display: string;
  value: number | null;
  unit: string | null;
  grade: FactGrade;
  /** Where it came from — a table or "regional median". */
  source: string;
  /** Regional median for the same figure, when meaningful. */
  regional: { display: string; value: number } | null;
}

export interface CountryFacts {
  code: string;
  name: string;
  onboarded: boolean;
  region: "OECS" | "CARICOM" | "reference";
  facts: Fact[];
  /** The framing inputs the record supports, each with the fact behind it. */
  proposed: Partial<Record<keyof PublicInput, { value: number; fact: string; grade: FactGrade }>>;
  termMonthsRemaining: number | null;
  generatedAt: string;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; facts: CountryFacts }>();

const nf = (v: number, d = 0) =>
  v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (v: number) =>
  v >= 1e9
    ? `US$${(v / 1e9).toFixed(2)} bn`
    : v >= 1e6
      ? `US$${(v / 1e6).toFixed(0)} m`
      : `US$${nf(v)}`;
const median = (xs: number[]): number | null => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};
const gradeOf = (c: unknown): FactGrade => {
  const g = String(c ?? "").toUpperCase();
  return g === "A" || g === "B" ? g : "C";
};

/** The 12 months before now, ISO. */
function yearAgo(): string {
  return new Date(Date.now() - 365 * 86_400_000).toISOString();
}

async function countryRow(sb: Admin, code: string) {
  const { data } = await sb
    .from("countries")
    .select(
      "code,name,gdp_current_usd,gdp_year,is_caricom,is_oecs,profile_committed_at,gdp_committed_at",
    )
    .eq("code", code)
    .maybeSingle();
  return data as {
    code: string;
    name: string;
    gdp_current_usd: number | null;
    gdp_year: number | null;
    is_caricom: boolean;
    is_oecs: boolean;
    profile_committed_at: string | null;
    gdp_committed_at: string | null;
  } | null;
}

/** Same-region peers, for medians. */
async function peerCodes(sb: Admin, c: { is_oecs: boolean; is_caricom: boolean; code: string }) {
  const q = sb.from("countries").select("code").neq("code", c.code);
  const { data } = c.is_oecs ? await q.eq("is_oecs", true) : await q.eq("is_caricom", true);
  return ((data ?? []) as Array<{ code: string }>).map((x) => x.code);
}

async function kpi(sb: Admin, code: string, codes: string[]) {
  const { data } = await sb
    .from("country_kpis")
    .select("kpi_code,latest_value,latest_period,confidence,unit")
    .eq("country_code", code)
    .in("kpi_code", codes)
    .not("latest_value", "is", null);
  return (data ?? []) as Array<{
    kpi_code: string;
    latest_value: number;
    latest_period: string | null;
    confidence: string | null;
    unit: string;
  }>;
}

const SPEND_CODES = [
  "gov_expenditure_gdp",
  "public_spend_gdp",
  "government_spending_pct_gdp",
  "expenditure_gdp",
];

export async function computeCountryFacts(code: string): Promise<CountryFacts | null> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.facts;

  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  const c = await countryRow(sb, code);
  if (!c) return null;
  const peers = await peerCodes(sb, c);
  const since = yearAgo();

  const [
    spendKpis,
    { data: sectors },
    { data: peerSectors },
    { count: decisionsYear },
    { data: commitments },
    { data: peerCommitments },
    { data: statusUpdates },
    { data: compacts },
    { count: projects },
    { count: offices },
    { count: bodies },
    { data: priorities },
    { data: plans },
    { data: prds },
    { data: peerGdp },
  ] = await Promise.all([
    kpi(sb, code, SPEND_CODES),
    sb
      .from("country_sectors")
      .select("sector_code,share_pct,confidence_grade")
      .eq("country_code", code),
    peers.length
      ? sb.from("country_sectors").select("country_code,share_pct").in("country_code", peers)
      : Promise.resolve({ data: [] as unknown[] }),
    sb
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("country_code", code)
      .gte("recorded_at", since),
    sb.from("commitments").select("status,due_at,created_at").eq("country_code", code),
    peers.length
      ? sb.from("commitments").select("country_code,status,due_at").in("country_code", peers)
      : Promise.resolve({ data: [] as unknown[] }),
    sb
      .from("compact_status_updates")
      .select(
        "deliverable_id,created_at,compact_deliverables!inner(created_at,compact_id,mandate_compacts!inner(country_code))",
      )
      .eq("compact_deliverables.mandate_compacts.country_code", code)
      .order("created_at", { ascending: true })
      .limit(500),
    sb
      .from("mandate_compacts")
      .select("election_cycle,status,created_at")
      .eq("country_code", code)
      .order("created_at", { ascending: false })
      .limit(1),
    sb
      .from("investment_projects")
      .select("id", { count: "exact", head: true })
      .eq("country_code", code)
      .eq("approval_status", "approved"),
    sb
      .from("government_offices")
      .select("id", { count: "exact", head: true })
      .eq("country_code", code)
      .eq("status", "verified")
      .eq("visibility", "public"),
    sb
      .from("statutory_bodies")
      .select("id", { count: "exact", head: true })
      .eq("country_code", code)
      .eq("status", "verified")
      .eq("visibility", "public"),
    sb
      .from("sector_priorities")
      .select("sector_code")
      .eq("country_code", code)
      .eq("status", "priority"),
    sb
      .from("sector_plans")
      .select("sector_code,status")
      .eq("country_code", code)
      .eq("status", "approved"),
    sb
      .from("egov_prds")
      .select("status,version")
      .eq("country_code", code)
      .eq("status", "approved")
      .limit(1),
    peers.length
      ? sb
          .from("countries")
          .select("gdp_current_usd")
          .in("code", peers)
          .not("gdp_current_usd", "is", null)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const facts: Fact[] = [];
  const proposed: CountryFacts["proposed"] = {};
  const gdp = c.gdp_current_usd != null ? Number(c.gdp_current_usd) : null;
  const gdpMed = median(
    ((peerGdp ?? []) as Array<{ gdp_current_usd: number }>).map((x) => Number(x.gdp_current_usd)),
  );
  facts.push({
    key: "gdp",
    label: "Nominal GDP",
    display: gdp != null ? `${usd(gdp)}${c.gdp_year ? ` (${c.gdp_year})` : ""}` : "Not recorded",
    value: gdp,
    unit: "USD",
    grade: gdp != null ? (c.gdp_committed_at ? "A" : "B") : "assumption",
    source: "countries",
    regional: gdpMed != null ? { display: usd(gdpMed), value: gdpMed } : null,
  });
  if (gdp != null)
    proposed.gdpUsd = { value: gdp, fact: "gdp", grade: c.gdp_committed_at ? "A" : "B" };

  const spend = spendKpis[0];
  facts.push({
    key: "public_spend",
    label: "Public spend, share of GDP",
    display: spend
      ? `${nf(spend.latest_value, 1)}%${spend.latest_period ? ` (${spend.latest_period})` : ""}`
      : "Regional median 27%",
    value: spend?.latest_value ?? 27,
    unit: "% of GDP",
    grade: spend ? gradeOf(spend.confidence) : "assumption",
    source: spend ? `country_kpis:${spend.kpi_code}` : "regional median",
    regional: { display: "27%", value: 27 },
  });
  proposed.publicSpendPct = {
    value: spend?.latest_value ?? 27,
    fact: "public_spend",
    grade: spend ? gradeOf(spend.confidence) : "assumption",
  };

  const secRows = (sectors ?? []) as Array<{
    sector_code: string;
    share_pct: number;
    confidence_grade: string;
  }>;
  const top = secRows.slice().sort((a, b) => Number(b.share_pct) - Number(a.share_pct))[0];
  const peerTop = new Map<string, number>();
  for (const r of (peerSectors ?? []) as Array<{ country_code: string; share_pct: number }>)
    peerTop.set(r.country_code, Math.max(peerTop.get(r.country_code) ?? 0, Number(r.share_pct)));
  const topMed = median([...peerTop.values()]);
  const { data: sectorLabels } = top
    ? await sb.from("sectors").select("code,label").eq("code", top.sector_code).maybeSingle()
    : { data: null };
  facts.push({
    key: "top_sector",
    label: "Largest sector, share of output",
    display: top
      ? `${(sectorLabels as { label?: string } | null)?.label ?? top.sector_code} · ${nf(Number(top.share_pct), 1)}%`
      : "Not recorded",
    value: top ? Number(top.share_pct) : null,
    unit: "% of GDP",
    grade: top ? gradeOf(top.confidence_grade) : "assumption",
    source: "country_sectors",
    regional: topMed != null ? { display: `${nf(topMed, 1)}%`, value: topMed } : null,
  });
  if (top)
    proposed.topSectorSharePct = {
      value: Number(top.share_pct),
      fact: "top_sector",
      grade: gradeOf(top.confidence_grade),
    };

  const com = (commitments ?? []) as Array<{
    status: string;
    due_at: string | null;
    created_at: string;
  }>;
  const openPastDue = com.filter(
    (k) =>
      !["delivered", "cancelled"].includes(k.status) &&
      k.due_at &&
      Date.parse(k.due_at) < Date.now(),
  ).length;
  const open = com.filter((k) => !["delivered", "cancelled"].includes(k.status)).length;
  const recent = com.filter((k) => k.created_at >= since).length;
  const cadence = Math.round(((decisionsYear ?? 0) + recent) / 4);
  const peerCom = (peerCommitments ?? []) as Array<{
    country_code: string;
    status: string;
    due_at: string | null;
  }>;
  const peerOpenPast = new Map<string, { open: number; past: number }>();
  for (const k of peerCom) {
    const e = peerOpenPast.get(k.country_code) ?? { open: 0, past: 0 };
    if (!["delivered", "cancelled"].includes(k.status)) {
      e.open++;
      if (k.due_at && Date.parse(k.due_at) < Date.now()) e.past++;
    }
    peerOpenPast.set(k.country_code, e);
  }
  const peerPastShare = median(
    [...peerOpenPast.values()].filter((e) => e.open).map((e) => (e.past / e.open) * 100),
  );
  facts.push({
    key: "cabinet",
    label: "Cabinet decisions recorded, last 12 months",
    display:
      decisionsYear || recent
        ? `${(decisionsYear ?? 0) + recent} · ${open} commitments open`
        : "No Cabinet record yet",
    value: cadence || null,
    unit: "per quarter",
    grade: decisionsYear || recent ? "A" : "assumption",
    source: "decisions, commitments",
    regional: { display: "24 a quarter", value: 24 },
  });
  if (cadence > 0)
    proposed.decisionsPerQuarter = {
      value: Math.max(4, Math.min(120, cadence)),
      fact: "cabinet",
      grade: "A",
    };
  facts.push({
    key: "follow_through",
    label: "Commitments open past their due date",
    display: open
      ? `${openPastDue} of ${open} (${nf((openPastDue / open) * 100)}%)`
      : "No commitments recorded",
    value: open ? (openPastDue / open) * 100 : null,
    unit: "% of open",
    grade: open ? "A" : "assumption",
    source: "commitments",
    regional:
      peerPastShare != null
        ? { display: `${nf(peerPastShare)}%`, value: peerPastShare }
        : { display: "35%", value: 35 },
  });

  // Latency: median months between a deliverable's creation and its first status update.
  const firstUpdate = new Map<string, { created: string; first: string }>();
  for (const u of (statusUpdates ?? []) as Array<{
    deliverable_id: string;
    created_at: string;
    compact_deliverables: { created_at: string } | null;
  }>) {
    if (!u.compact_deliverables || firstUpdate.has(u.deliverable_id)) continue;
    firstUpdate.set(u.deliverable_id, {
      created: u.compact_deliverables.created_at,
      first: u.created_at,
    });
  }
  const latMonths = median(
    [...firstUpdate.values()].map(
      (x) => (Date.parse(x.first) - Date.parse(x.created)) / (30.4 * 86_400_000),
    ),
  );
  facts.push({
    key: "latency",
    label: "Months from decision to first recorded progress",
    display: latMonths != null ? `${nf(latMonths, 1)} months` : "No record — regional median 6",
    value: latMonths,
    unit: "months",
    grade: latMonths != null ? "B" : "assumption",
    source: latMonths != null ? "compact_status_updates" : "regional median",
    regional: { display: "6 months", value: 6 },
  });
  if (latMonths != null)
    proposed.latencyMonths = {
      value: Math.max(1, Math.min(18, Math.round(latMonths))),
      fact: "latency",
      grade: "B",
    };

  // Unmeasured spend proxy: standards-audit requirements not collected, weighted by impact.
  let coverage: number | null = null;
  let unmeasured: number | null = null;
  try {
    const { computeCountryAudit } = await import("@/lib/standards/audit-data.server");
    const audit = await computeCountryAudit(sb as never, code);
    coverage = audit.summary.coveragePct;
    const w = (i: string) => (i === "high" ? 3 : i === "medium" ? 2 : 1);
    const tot = audit.rows.reduce((s, r) => s + w(String(r.impact)), 0);
    const miss = audit.rows
      .filter((r) => r.status !== "collected")
      .reduce((s, r) => s + w(String(r.impact)), 0);
    unmeasured = tot ? Math.round((miss / tot) * 80) : null; // scaled to the model's 0–80 range
  } catch {
    // no audit library
  }
  facts.push({
    key: "standards",
    label: "Reporting standards coverage",
    display: coverage != null ? `${nf(coverage)}% of requirements collected` : "Audit not run",
    value: coverage,
    unit: "%",
    grade: coverage != null ? "A" : "assumption",
    source: "standards audit",
    regional: null,
  });
  if (unmeasured != null)
    proposed.unmeasuredPct = { value: unmeasured, fact: "standards", grade: "B" };

  facts.push({
    key: "projects",
    label: "Approved investment projects",
    display: `${projects ?? 0}`,
    value: projects ?? 0,
    unit: "projects",
    grade: "A",
    source: "investment_projects (approved)",
    regional: null,
  });

  const prd = ((prds ?? []) as Array<{ version: number }>)[0];
  facts.push({
    key: "government",
    label: "Government record and platform",
    display: `${offices ?? 0} offices · ${bodies ?? 0} statutory bodies${prd ? ` · PRD v${prd.version} approved` : " · no platform PRD yet"}`,
    value: (offices ?? 0) + (bodies ?? 0),
    unit: "verified rows",
    grade: (offices ?? 0) + (bodies ?? 0) > 0 ? "A" : "assumption",
    source: "government_offices, statutory_bodies, egov_prds",
    regional: null,
  });
  // Services offline: no direct measure yet; a PRD in place lowers the default.
  proposed.servicesOfflinePct = { value: prd ? 45 : 60, fact: "government", grade: "assumption" };

  const pri = ((priorities ?? []) as Array<{ sector_code: string }>).map((p) => p.sector_code);
  const planned = new Set(
    ((plans ?? []) as Array<{ sector_code: string }>).map((p) => p.sector_code),
  );
  const shareBy = new Map(secRows.map((s) => [s.sector_code, Number(s.share_pct)]));
  const unplanned = pri
    .filter((s) => !planned.has(s))
    .reduce((sum, s) => sum + (shareBy.get(s) ?? 0), 0);
  facts.push({
    key: "sectors",
    label: "Priority sectors with an approved plan",
    display: pri.length
      ? `${pri.length - pri.filter((s) => !planned.has(s)).length} of ${pri.length}`
      : "No priorities chosen",
    value: pri.length ? unplanned : null,
    unit: "% of GDP unplanned",
    grade: pri.length ? "A" : "assumption",
    source: "sector_priorities, sector_plans",
    regional: null,
  });
  proposed.unplannedPrioritySharePct = pri.length
    ? { value: Math.round(unplanned), fact: "sectors", grade: "A" }
    : { value: 30, fact: "sectors", grade: "assumption" };

  // Term remaining, from the compact's election cycle ("2023-2028", "2023").
  const cycle = ((compacts ?? []) as Array<{ election_cycle: string }>)[0]?.election_cycle ?? null;
  let termMonthsRemaining: number | null = null;
  const yrs = cycle?.match(/(\d{4})\D+(\d{4})/) ?? cycle?.match(/(\d{4})/);
  if (yrs) {
    const end = yrs[2] ? Number(yrs[2]) : Number(yrs[1]) + 5;
    termMonthsRemaining = Math.max(
      0,
      Math.round((Date.UTC(end, 0, 1) - Date.now()) / (30.4 * 86_400_000)),
    );
  }

  const onboarded = !!(c.profile_committed_at || gdp != null);
  const out: CountryFacts = {
    code: c.code,
    name: c.name,
    onboarded,
    region: c.is_oecs ? "OECS" : c.is_caricom ? "CARICOM" : "reference",
    facts,
    proposed,
    termMonthsRemaining,
    generatedAt: new Date().toISOString(),
  };
  cache.set(code, { at: Date.now(), facts: out });
  return out;
}

export async function listBriefCountries(): Promise<
  Array<{ code: string; name: string; onboarded: boolean }>
> {
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  const { data } = await sb
    .from("countries")
    .select("code,name,gdp_current_usd,profile_committed_at")
    .order("name");
  return (
    (data ?? []) as Array<{
      code: string;
      name: string;
      gdp_current_usd: number | null;
      profile_committed_at: string | null;
    }>
  ).map((c) => ({
    code: c.code,
    name: c.name,
    onboarded: !!(c.profile_committed_at || c.gdp_current_usd != null),
  }));
}
