// Server-only. Builds a stable "country context" block reused by every
// onboarding agent. Ensures each agent knows the country's region, TLD,
// gov portal, and what prior stages already committed — so prompts aren't
// context-blind and downstream stages don't re-research basics.

import { CARICOM_OECS_REGISTRY } from "@/lib/caricom-registry";

// Canonical government TLDs / official portal URLs per country code (ISO3).
// Used for Perplexity `search_domain_filter` and to point discovery queries
// at the actual national portal. Keep to the small-nation set we onboard.
const COUNTRY_META: Record<
  string,
  { tld: string; portal: string; statsOffice?: string; centralBank?: string }
> = {
  ATG: { tld: "gov.ag", portal: "https://ab.gov.ag", statsOffice: "https://statistics.gov.ag", centralBank: "https://www.eccb-centralbank.org" },
  BHS: { tld: "gov.bs", portal: "https://www.bahamas.gov.bs", statsOffice: "https://www.bahamas.gov.bs/statistics" },
  BRB: { tld: "gov.bb", portal: "https://www.gov.bb", statsOffice: "https://www.barstats.gov.bb" },
  BLZ: { tld: "gov.bz", portal: "https://www.gov.bz", statsOffice: "https://sib.org.bz" },
  DMA: { tld: "gov.dm", portal: "https://dominica.gov.dm", centralBank: "https://www.eccb-centralbank.org" },
  GRD: { tld: "gov.gd", portal: "https://www.gov.gd", centralBank: "https://www.eccb-centralbank.org" },
  GUY: { tld: "gov.gy", portal: "https://www.gov.gy", statsOffice: "https://statisticsguyana.gov.gy" },
  HTI: { tld: "gouv.ht", portal: "https://www.primature.gouv.ht" },
  JAM: { tld: "gov.jm", portal: "https://www.gov.jm", statsOffice: "https://statinja.gov.jm" },
  MSR: { tld: "gov.ms", portal: "https://www.gov.ms" },
  KNA: { tld: "gov.kn", portal: "https://www.gov.kn", centralBank: "https://www.eccb-centralbank.org" },
  LCA: { tld: "gov.lc", portal: "https://www.govt.lc", statsOffice: "https://www.stats.gov.lc", centralBank: "https://www.eccb-centralbank.org" },
  VCT: { tld: "gov.vc", portal: "https://www.gov.vc", centralBank: "https://www.eccb-centralbank.org" },
  SUR: { tld: "gov.sr", portal: "https://www.gov.sr" },
  TTO: { tld: "gov.tt", portal: "https://www.gov.tt", statsOffice: "https://cso.gov.tt" },
  AIA: { tld: "gov.ai", portal: "https://www.gov.ai", centralBank: "https://www.eccb-centralbank.org" },
  BMU: { tld: "gov.bm", portal: "https://www.gov.bm" },
  VGB: { tld: "gov.vg", portal: "https://www.bvi.gov.vg" },
  CYM: { tld: "gov.ky", portal: "https://www.gov.ky" },
  TCA: { tld: "gov.tc", portal: "https://www.gov.tc" },
};

export type CountryContext = {
  code: string;
  name: string;
  iso3: string | null;
  currency: string;
  fiscal_year_start_month: number;
  region: string;
  subRegion: string;
  membershipTier: string | null;
  isCbiState: boolean;
  tld: string | null;
  portal: string | null;
  statsOffice: string | null;
  centralBank: string | null;
  /** Learned domains promoted from prior open-web passes. */
  learnedDomains: Array<{ domain: string; tier: string }>;
  // Prior committed data (empty when stage not yet committed)
  committed: {
    profile: any | null;
    gdp: { gdp_current_usd: number | null; gdp_year: number | null };
    sectors: Array<{ sector_code: string; share_pct: number }>;
    ministries: Array<{ slug: string; name: string; minister: string | null }>;
  };
};

export async function buildCountryContext(admin: any, code: string): Promise<CountryContext> {
  const { data: c, error } = await admin
    .from("countries")
    .select("code, name, iso3, currency, fiscal_year_start_month, gdp_current_usd, gdp_year, membership_tier, country_pack")
    .eq("code", code)
    .maybeSingle();
  if (error || !c) throw new Error(`Country ${code} not found`);

  const iso3 = c.iso3 ?? c.code;
  const meta = COUNTRY_META[iso3] ?? null;
  const regEntry = CARICOM_OECS_REGISTRY.find((r) => r.code === iso3);

  const [sectorsRes, ministriesRes, learnedRes] = await Promise.all([
    admin.from("country_sectors").select("sector_code, share_pct").eq("country_code", code),
    admin.from("ministries").select("slug, name").eq("country_code", code),
    admin
      .from("country_authorized_domains")
      .select("domain, tier")
      .eq("country_code", code)
      .is("demoted_at", null),
  ]);

  const ministrySlugs = (ministriesRes.data ?? []).map((m: any) => m.slug);
  const { data: ministerProfiles } = ministrySlugs.length
    ? await admin
        .from("ministry_profiles")
        .select("ministry_slug, minister")
        .eq("country_code", code)
        .in("ministry_slug", ministrySlugs)
    : { data: [] as any[] };
  const byMin = new Map<string, string | null>((ministerProfiles ?? []).map((m: any) => [m.ministry_slug, m.minister]));

  return {
    code: c.code,
    name: c.name,
    iso3,
    currency: c.currency,
    fiscal_year_start_month: c.fiscal_year_start_month,
    region: "Caribbean",
    subRegion: regEntry?.tier?.startsWith("oecs") || regEntry?.cbiState ? "OECS" : regEntry ? "CARICOM" : "Caribbean",
    membershipTier: regEntry?.tier ?? null,
    isCbiState: !!regEntry?.cbiState,
    tld: meta?.tld ?? null,
    portal: meta?.portal ?? null,
    statsOffice: meta?.statsOffice ?? null,
    centralBank: meta?.centralBank ?? null,
    committed: {
      profile: (c.country_pack as any)?.profile ?? null,
      gdp: { gdp_current_usd: c.gdp_current_usd ?? null, gdp_year: c.gdp_year ?? null },
      sectors: (sectorsRes.data ?? []) as any[],
      ministries: (ministriesRes.data ?? []).map((m: any) => ({
        slug: m.slug,
        name: m.name,
        minister: byMin.get(m.slug) ?? null,
      })),
    },
  };
}

/** Render context as a compact block prepended to every agent prompt. */
export function renderContextBlock(ctx: CountryContext): string {
  const lines: string[] = [];
  lines.push(`COUNTRY CONTEXT`);
  lines.push(`- Name: ${ctx.name}  (ISO3: ${ctx.iso3 ?? "—"})`);
  lines.push(`- Region: ${ctx.region} / ${ctx.subRegion}${ctx.membershipTier ? `  (${ctx.membershipTier}${ctx.isCbiState ? ", CBI state" : ""})` : ""}`);
  if (ctx.portal) lines.push(`- Official government portal: ${ctx.portal}`);
  if (ctx.statsOffice) lines.push(`- Statistics office: ${ctx.statsOffice}`);
  if (ctx.centralBank) lines.push(`- Central bank: ${ctx.centralBank}`);
  if (ctx.tld) lines.push(`- Preferred national TLD: .${ctx.tld}`);
  lines.push(`- Currency: ${ctx.currency}  |  Fiscal year starts month: ${ctx.fiscal_year_start_month}`);
  if (ctx.committed.gdp.gdp_current_usd) {
    lines.push(`- Committed GDP: ${ctx.committed.gdp.gdp_current_usd.toLocaleString()} USD (${ctx.committed.gdp.gdp_year})`);
  }
  if (ctx.committed.sectors.length) {
    const top = [...ctx.committed.sectors]
      .sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0))
      .slice(0, 5)
      .map((s) => `${s.sector_code} ${Number(s.share_pct).toFixed(0)}%`)
      .join(", ");
    lines.push(`- Top committed sectors: ${top}`);
  }
  if (ctx.committed.ministries.length) {
    lines.push(`- Committed ministries (${ctx.committed.ministries.length}): ${ctx.committed.ministries.map((m) => m.slug).join(", ")}`);
  }
  return lines.join("\n");
}

/** Extra domains to prefer when Perplexity searches for this country. */
export function contextDomains(ctx: CountryContext): string[] {
  const out: string[] = [];
  if (ctx.tld) out.push(ctx.tld);
  if (ctx.portal) {
    try { out.push(new URL(ctx.portal).hostname.replace(/^www\./, "")); } catch { /* noop */ }
  }
  if (ctx.statsOffice) {
    try { out.push(new URL(ctx.statsOffice).hostname.replace(/^www\./, "")); } catch { /* noop */ }
  }
  if (ctx.centralBank) {
    try { out.push(new URL(ctx.centralBank).hostname.replace(/^www\./, "")); } catch { /* noop */ }
  }
  return out;
}
