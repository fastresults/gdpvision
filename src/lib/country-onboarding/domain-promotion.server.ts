// Server-only. Learned-domain promotion for the onboarding research pipeline.
//
// When a Perplexity attempt with NO domain filter (open-web pass) returns a
// validated payload, the citing hosts are candidates for promotion into
// `country_authorized_domains`. Once promoted, subsequent stages/runs for
// that country automatically include those domains in the search filter.

import type { SonarCitation } from "./perplexity.server";

// Never promote these — social, forums, content farms, AI-slop hosts.
const BLOCKLIST = new Set<string>([
  "reddit.com",
  "quora.com",
  "medium.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
  "answers.com",
  "ehow.com",
]);

// Reference tier — allowed but never authoritative on its own.
const REFERENCE_HOSTS = new Set<string>([
  "wikipedia.org",
  "en.wikipedia.org",
  "britannica.com",
]);

// Multilateral / official-by-nature TLD or suffix.
const OFFICIAL_TLDS = [".gov", ".gouv", ".int", ".edu", ".eu"];
const OFFICIAL_HOSTS = new Set<string>([
  "worldbank.org",
  "imf.org",
  "un.org",
  "undp.org",
  "iadb.org",
  "who.int",
  "fao.org",
  "oecs.int",
  "oecs.org",
  "caricom.org",
  "eccb-centralbank.org",
  "cdb.org",
]);

// Small curated Caribbean press seed.
const PRESS_HOSTS = new Set<string>([
  "jamaica-gleaner.com",
  "jamaicaobserver.com",
  "loopnews.com",
  "caribbeannationalweekly.com",
  "trinidadexpress.com",
  "newsday.co.tt",
  "guardian.co.tt",
  "antiguaobserver.com",
  "antiguanewsroom.com",
  "stluciatimes.com",
  "stlucianewsonline.com",
  "dominicanewsonline.com",
  "nationnews.com",
  "stabroeknews.com",
  "kaieteurnewsonline.com",
]);

export type DomainTier = "official" | "learned" | "reference" | "press";

export function classifyDomain(domain: string): DomainTier | "blocked" | null {
  const d = (domain || "").toLowerCase().replace(/^www\./, "");
  if (!d || d.length < 4 || !d.includes(".")) return null;
  if (BLOCKLIST.has(d)) return "blocked";
  for (const b of BLOCKLIST) if (d.endsWith("." + b)) return "blocked";
  if (REFERENCE_HOSTS.has(d)) return "reference";
  for (const r of REFERENCE_HOSTS) if (d.endsWith("." + r)) return "reference";
  if (OFFICIAL_HOSTS.has(d)) return "official";
  for (const h of OFFICIAL_HOSTS) if (d.endsWith("." + h)) return "official";
  for (const t of OFFICIAL_TLDS) if (d.endsWith(t) || d.includes(t + ".")) return "official";
  if (PRESS_HOSTS.has(d)) return "press";
  return "learned";
}

/** Load the current (non-demoted) learned/official domains for this country. */
export async function loadLearnedDomains(
  admin: any,
  countryCode: string,
): Promise<Array<{ domain: string; tier: DomainTier }>> {
  const { data, error } = await admin
    .from("country_authorized_domains")
    .select("domain, tier")
    .eq("country_code", countryCode)
    .is("demoted_at", null);
  if (error) return [];
  return (data ?? []) as Array<{ domain: string; tier: DomainTier }>;
}

/**
 * Promote citing domains from an accepted open-web pass. Upserts into
 * `country_authorized_domains`, then stamps the just-inserted
 * `onboarding_citations` rows with `domain_tier` + `promoted_domain`.
 *
 * `openWeb` should be true only when Tier 1 succeeded without a domain
 * filter — filtered-pass citations don't need promotion (already in the
 * allowlist).
 */
export async function promoteFromCitations(
  admin: any,
  args: {
    countryCode: string;
    stage: string;
    draftId: string;
    citations: SonarCitation[];
    openWeb: boolean;
  },
): Promise<{ promoted: string[]; reference: string[]; blocked: string[] }> {
  const promoted: string[] = [];
  const reference: string[] = [];
  const blocked: string[] = [];

  if (!args.citations.length) return { promoted, reference, blocked };

  // Classify unique domains.
  const seen = new Map<string, DomainTier | "blocked" | null>();
  for (const c of args.citations) {
    const d = (c.domain || "").toLowerCase().replace(/^www\./, "");
    if (!d || seen.has(d)) continue;
    seen.set(d, classifyDomain(d));
  }

  // Upsert candidates (skip blocked and null).
  const upserts: Array<{
    country_code: string;
    domain: string;
    tier: DomainTier;
    first_seen_stage: string;
    last_used_at: string;
  }> = [];
  for (const [d, cls] of seen) {
    if (!cls || cls === "blocked") {
      if (cls === "blocked") blocked.push(d);
      continue;
    }
    if (cls === "reference") {
      reference.push(d);
      // Also record reference tier so admins see it, but do NOT count as promoted.
    }
    // Promote only from open-web attempts (or when tier is official — free win regardless).
    if (!args.openWeb && cls !== "official") continue;
    upserts.push({
      country_code: args.countryCode,
      domain: d,
      tier: cls,
      first_seen_stage: args.stage,
      last_used_at: new Date().toISOString(),
    });
    if (cls !== "reference") promoted.push(d);
  }

  if (upserts.length) {
    // upsert on (country_code, domain) — increment citation_count on conflict.
    for (const row of upserts) {
      const { data: existing } = await admin
        .from("country_authorized_domains")
        .select("id, citation_count, demoted_at")
        .eq("country_code", row.country_code)
        .eq("domain", row.domain)
        .maybeSingle();
      if (existing) {
        // Don't resurrect a demoted domain automatically.
        if (existing.demoted_at) continue;
        await admin
          .from("country_authorized_domains")
          .update({
            citation_count: (existing.citation_count ?? 1) + 1,
            last_used_at: row.last_used_at,
          })
          .eq("id", existing.id);
      } else {
        await admin.from("country_authorized_domains").insert(row);
      }
    }
  }

  // Stamp citation rows with their tier.
  const promotedSet = new Set(promoted);
  for (const [d, cls] of seen) {
    if (!cls || cls === "blocked") continue;
    await admin
      .from("onboarding_citations")
      .update({
        domain_tier: cls,
        promoted_domain: promotedSet.has(d),
      })
      .eq("draft_id", args.draftId)
      .eq("domain", d);
  }

  return { promoted, reference, blocked };
}
