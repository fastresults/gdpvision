// Chamber 05 · entity watchlist.
// Seeds a list of names that MUST be queried against news per country
// (ministers, PM, ambassadors, envoys, CBI program, top SOEs), and turns
// each into a Google News RSS feed so the harvester picks up stories by
// *person* — not just macro nouns. This is what catches things like
// "Judgment against Antigua's former economic envoy Alex Saab."
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_ENTITY_FEEDS_PER_COUNTRY = 12;

type EntityRow = {
  id: string;
  country_code: string;
  entity_name: string;
  entity_role: string | null;
  source: string;
  active: boolean;
};

function urlEncodeQuery(s: string) {
  return encodeURIComponent(s).replace(/%20/g, "+");
}

function googleNewsRss(countryName: string, entityName: string) {
  const q = `"${entityName}" ${countryName}`;
  return `https://news.google.com/rss/search?q=${urlEncodeQuery(q)}&hl=en-US&gl=US&ceid=US:en`;
}

async function fetchCountryName(cc: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("countries").select("name").eq("code", cc).maybeSingle();
  return (data?.name as string) ?? cc;
}

// Auto-seed watchlist entries from the corpus (ministers, country_profiles).
export async function seedWatchlistFromCorpus(countryCode: string): Promise<{ added: number }> {
  const seeds: Array<{ entity_name: string; entity_role: string; source: string }> = [];

  // Ministers
  const { data: mins } = await supabaseAdmin
    .from("ministry_profiles")
    .select("minister,minister_profile")
    .eq("country_code", countryCode);
  for (const m of mins ?? []) {
    const scalarName = (m as { minister?: string | null }).minister ?? null;
    const profileName = ((m as { minister_profile?: { name?: string | null } | null }).minister_profile)?.name ?? null;
    const nm = scalarName ?? profileName;
    if (nm && nm.length > 2) {
      seeds.push({ entity_name: nm, entity_role: "minister", source: "auto:ministry_profiles" });
    }
  }

  // Country profile — head of government / head of state if present
  const { data: cp } = await supabaseAdmin
    .from("countries").select("name").eq("code", countryCode).maybeSingle();
  // We don't have a specific head_of_gov column here — Google News queries with country name
  // handle "Prime Minister <Country>" naturally through the governance lane. This helper stays
  // conservative and only pulls confirmed names from the corpus.
  void cp;

  if (seeds.length === 0) return { added: 0 };

  // Dedup by name (case-insensitive)
  const seen = new Set<string>();
  const uniq = seeds.filter((s) => {
    const k = s.entity_name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let added = 0;
  for (const s of uniq.slice(0, MAX_ENTITY_FEEDS_PER_COUNTRY * 2)) {
    const { error } = await supabaseAdmin
      .from("narrative_entity_watchlist")
      .upsert(
        { country_code: countryCode, entity_name: s.entity_name, entity_role: s.entity_role, source: s.source, active: true },
        { onConflict: "country_code,entity_name" },
      );
    if (!error) added++;
  }
  return { added };
}

// Turn every active watchlist entity into a Google News RSS feed
// (kind: google_news, scope: international, tier_hint: entity).
export async function buildEntityFeedsForCountry(countryCode: string): Promise<{ inserted: number; kept: number }> {
  const countryName = await fetchCountryName(countryCode);

  const { data: entities } = await supabaseAdmin
    .from("narrative_entity_watchlist")
    .select("id,country_code,entity_name,entity_role,source,active")
    .eq("country_code", countryCode)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(MAX_ENTITY_FEEDS_PER_COUNTRY);

  const rows = (entities ?? []) as EntityRow[];
  if (rows.length === 0) return { inserted: 0, kept: 0 };

  let inserted = 0;
  const nowIso = new Date().toISOString();
  for (const e of rows) {
    const endpoint = googleNewsRss(countryName, e.entity_name);
    const { error } = await supabaseAdmin.from("narrative_feeds").upsert(
      {
        country_code: countryCode,
        scope: "international",
        kind: "google_news",
        endpoint,
        label: `Watch · ${e.entity_name} (${e.entity_role ?? "entity"})`,
        is_seed: false,
        is_query: true,
        tier_hint: "entity",
        discovered_at: nowIso,
        active: true,
      },
      { onConflict: "country_code,endpoint" },
    );
    if (!error) inserted++;
    await supabaseAdmin
      .from("narrative_entity_watchlist")
      .update({ last_feed_built_at: nowIso })
      .eq("id", e.id);
  }
  return { inserted, kept: rows.length };
}

// Full weekly refresh across all active countries.
export async function refreshAllWatchlists(): Promise<Array<{ code: string; seeded: number; built: number }>> {
  const { data: cs } = await supabaseAdmin
    .from("countries").select("code").order("code");
  const out: Array<{ code: string; seeded: number; built: number }> = [];
  for (const c of cs ?? []) {
    const cc = c.code as string;
    try {
      const seeded = (await seedWatchlistFromCorpus(cc)).added;
      const built = (await buildEntityFeedsForCountry(cc)).inserted;
      out.push({ code: cc, seeded, built });
    } catch (e) {
      console.error("[watchlist]", cc, (e as Error).message);
    }
  }
  return out;
}
