// Chamber 05 — tags untagged stories (politics / GDP / government) from the
// last 30 days. AI in batches, keyword fallback. Scores and levels untouched.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { keywordTags } from "@/lib/narrative-keyword-tags";
import { naturalLevel, type GuaranteeSignal } from "@/lib/narrative-p1-guarantee";

type Tag = { i: number; is_political: boolean; is_economic: boolean; mentions_government: boolean; tags: string[] };
type Item = GuaranteeSignal & { topic: string | null; summary: string | null; scope_key: string };

async function aiTag(items: Item[]): Promise<Map<number, Tag> | null> {
  try {
    const { callGeminiJson } = await import("@/lib/country-onboarding/gemini.server");
    const lines = items.map((it, i) => `${i}. ${(it.topic ?? "").slice(0, 160)} — ${(it.summary ?? "").slice(0, 280)}`).join("\n");
    const { parsed } = await callGeminiJson<{ items: Tag[] }>({
      system: "You tag Caribbean news stories for a government narrative team. Be accurate and cautious.",
      user: `For each numbered story set is_political (elections, parties, government, ministers, policy, diplomacy), is_economic (GDP, growth, budget, debt, investment, trade, tourism receipts, jobs, prices), mentions_government (names the government, a ministry or a minister) and up to 4 short lowercase tags.\n\n${lines}`,
      schemaHint: '{"items":[{"i":0,"is_political":true,"is_economic":false,"mentions_government":true,"tags":["election"]}]}',
    });
    if (!parsed?.items) return null;
    return new Map(parsed.items.map((t) => [Number(t.i), t]));
  } catch {
    return null;
  }
}

export async function retagBacklog(opts: { countries?: string[]; stopWhenCovered?: boolean; maxPerCountry?: number } = {}) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let codes = opts.countries;
  if (!codes) {
    const { data } = await supabaseAdmin.from("intake_items").select("scope_key").is("is_political", null).gte("created_at", since).limit(20000);
    codes = Array.from(new Set((data ?? []).map((r) => r.scope_key as string))).filter((c) => c && c !== "CAR");
  }
  const max = opts.maxPerCountry ?? 400;
  const out: Record<string, { tagged: number; ai: number; keyword: number }> = {};
  for (const cc of codes) {
    const { data } = await supabaseAdmin
      .from("intake_items")
      .select("id,scope_key,topic,summary,recommendation,severity,reach,is_political,is_economic,priority_score,state,review_verdict,created_at")
      .eq("scope_key", cc)
      .is("is_political", null)
      .gte("created_at", since)
      .not("state", "in", "(duplicate,dismissed)")
      .limit(3000);
    const rows = ((data ?? []) as unknown as Item[])
      .filter((r) => naturalLevel(r) <= 4)
      .sort((a, b) => naturalLevel(a) - naturalLevel(b) || (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0))
      .slice(0, max);
    const stat = { tagged: 0, ai: 0, keyword: 0 };
    let pol = false, gdp = false;
    for (let k = 0; k < rows.length; k += 40) {
      const batch = rows.slice(k, k + 40);
      const ai = await aiTag(batch);
      for (let i = 0; i < batch.length; i++) {
        const t = ai?.get(i) ?? keywordTags(`${batch[i].topic ?? ""} ${batch[i].summary ?? ""}`);
        if (ai?.get(i)) stat.ai++; else stat.keyword++;
        pol ||= !!t.is_political; gdp ||= !!t.is_economic;
        await supabaseAdmin
          .from("intake_items")
          .update({ is_political: !!t.is_political, is_economic: !!t.is_economic, mentions_government: !!t.mentions_government, tags: (t.tags ?? []).slice(0, 6) })
          .eq("id", batch[i].id);
        stat.tagged++;
      }
      if (opts.stopWhenCovered && pol && gdp) break;
    }
    out[cc] = stat;
  }
  return out;
}

/** Countries currently missing a P1 GDP or P1 political story. */
export async function gapCountries(): Promise<string[]> {
  const { coverageReport } = await import("@/lib/media-scan.server");
  const rows = await coverageReport();
  return rows.filter((r) => r.code !== "CAR" && (r.p1_gdp === "gap" || r.p1_political === "gap")).map((r) => r.code);
}

export async function fixGaps(countries?: string[]) {
  const { enforceP1Guarantee } = await import("@/lib/narrative-p1-guarantee.server");
  const { discoverForCountry } = await import("@/lib/press-discover.server");
  const targets = countries ?? (await gapCountries());
  const retag = await retagBacklog({ countries: targets, stopWhenCovered: true });
  const before = await enforceP1Guarantee(targets);
  const stillGap = targets.filter((c) => before[c]?.gdp === "gap" || before[c]?.politics === "gap");
  const { data: names } = await supabaseAdmin.from("narrative_media_countries").select("code,name").in("code", stillGap);
  const { data: names2 } = await supabaseAdmin.from("countries").select("code,name").in("code", stillGap);
  const nameOf = new Map([...(names ?? []), ...(names2 ?? [])].map((c) => [c.code as string, (c.name as string) ?? c.code]));
  const discovered: Record<string, number> = {};
  for (const cc of stillGap) {
    try {
      discovered[cc] = (await discoverForCountry(cc, nameOf.get(cc) ?? cc)).inserted;
    } catch {
      discovered[cc] = 0;
    }
  }
  return { targets, retag, guarantee: before, still_gap: stillGap, outlets_added: discovered };
}
