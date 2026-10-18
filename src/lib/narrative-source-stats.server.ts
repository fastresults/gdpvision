// Chamber 05 · daily source-strength recompute. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeSourceStrength } from "@/lib/narrative-source-strength";

export async function recomputeSourceStats() {
  const { data: raw, error } = await supabaseAdmin.rpc("narrative_source_raw_stats");
  if (error) throw new Error(error.message);
  const [{ data: feeds }, { data: outlets }] = await Promise.all([
    supabaseAdmin.from("narrative_feeds").select("id,endpoint"),
    supabaseAdmin.from("narrative_outlets").select("domain,credibility"),
  ]);
  const endpointOf = new Map((feeds ?? []).map((f) => [f.id as string, f.endpoint as string]));
  const credOf = (feedId: string) => {
    const ep = endpointOf.get(feedId) ?? "";
    for (const o of outlets ?? []) if (ep.includes(o.domain as string)) return o.credibility as number;
    return null;
  };
  const now = new Date().toISOString();
  const rows = (raw ?? []).map((r) => {
    const c = computeSourceStrength({
      scope: r.scope,
      active: r.active,
      consecutive_failures: r.consecutive_failures,
      reach_tier: r.reach_tier,
      admin_weight: Number(r.admin_weight) || 1,
      outlet_credibility: credOf(r.feed_id),
      items: Number(r.items),
      relevant: Number(r.relevant),
      hits: Number(r.hits),
      primaries: Number(r.primaries),
      followed: Number(r.followed),
      broken: Number(r.broken),
      dismissed: Number(r.dismissed),
      confirmed: Number(r.confirmed),
    });
    return {
      feed_id: r.feed_id,
      country_code: r.country_code,
      items_30d: Number(r.items),
      last_item_at: r.last_item_at,
      computed_at: now,
      ...c,
    };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const { error: e } = await supabaseAdmin
      .from("narrative_source_stats")
      .upsert(rows.slice(i, i + 200), { onConflict: "feed_id" });
    if (e) throw new Error(e.message);
  }
  return { sources: rows.length };
}
