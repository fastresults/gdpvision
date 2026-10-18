// Chamber 05 — applies the P1 guarantee after each scan. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pickGuaranteedP1, type GuaranteeSignal, type GuaranteeTopic } from "@/lib/narrative-p1-guarantee";

const LABEL: Record<GuaranteeTopic, string> = { gdp: "GDP", politics: "political" };

export async function enforceP1Guarantee(countryCodes: string[]) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: names } = await supabaseAdmin.from("countries").select("code,name").in("code", countryCodes);
  const nameOf = new Map((names ?? []).map((c) => [c.code as string, (c.name as string) ?? c.code]));
  const report: Record<string, Record<GuaranteeTopic, string>> = {};
  for (const cc of countryCodes) {
    const { data } = await supabaseAdmin
      .from("intake_items")
      .select("id,recommendation,severity,reach,is_political,is_economic,priority_score,priority_override,priority_raised_reason,state,review_verdict,created_at")
      .eq("scope_key", cc)
      .gte("created_at", since)
      .or("story_primary.is.true,story_primary.is.null")
      .limit(5000);
    const rows = (data ?? []) as unknown as (GuaranteeSignal & { priority_raised_reason: string | null })[];
    const keep = new Set<string>();
    const out = {} as Record<GuaranteeTopic, string>;
    for (const topic of ["gdp", "politics"] as GuaranteeTopic[]) {
      const r = pickGuaranteedP1(rows, topic);
      out[topic] = r.status;
      if (r.status !== "raised") continue;
      keep.add(r.id);
      const reason = `Raised from P${r.from}: top ${LABEL[topic]} story for ${nameOf.get(cc) ?? cc} this scan.`;
      const prev = rows.find((x) => x.id === r.id);
      const merged = prev?.priority_override === 1 && prev.priority_raised_reason && !prev.priority_raised_reason.includes(LABEL[topic] + " story")
        ? `${prev.priority_raised_reason} ${reason}` : reason;
      await supabaseAdmin
        .from("intake_items")
        .update({ priority_override: 1, priority_raised_from: r.from, priority_raised_reason: merged })
        .eq("id", r.id);
    }
    const stale = rows.filter((x) => x.priority_override === 1 && !keep.has(x.id)).map((x) => x.id);
    if (stale.length)
      await supabaseAdmin
        .from("intake_items")
        .update({ priority_override: null, priority_raised_from: null, priority_raised_reason: null })
        .in("id", stale);
    report[cc] = out;
  }
  return report;
}
