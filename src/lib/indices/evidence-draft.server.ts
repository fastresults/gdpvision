// @domain indices
// @tables index_indicators,index_evidence,countries
// @ui src/components/indices/admin/EvidenceTab.tsx
//
// AI-drafted evidence for one documentary indicator across every state. Drafts
// are saved UNVERIFIED (entered_by null, notes say "AI draft") so a steward must
// confirm each one before a run counts it. Nothing is invented: a state with no
// cited https source and quote is skipped and reported as "no source found".
// States that already have a value (draft or verified) are left alone.

import { z } from "zod";
import { perplexityFetch } from "@/lib/perplexity-agent";
import { db, type AnyClient } from "@/lib/syndication/db";
import { validDraft, type DraftItem } from "./evidence-draft";

const Item = z.object({
  country: z.string(),
  value: z.number().nullable(),
  period: z.string().nullable(),
  document_title: z.string().nullable(),
  document_url: z.string().nullable(),
  document_date: z.string().nullable().optional(),
  publisher: z.string().nullable(),
  quote: z.string().nullable(),
});

export async function draftIndicatorEvidence(indexCode: string, indicatorCode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const c = db(supabaseAdmin as AnyClient);
  const { data: ind, error: ie } = await c
    .from("index_indicators")
    .select("index_code,code,name,unit,goal_best,goal_worst,source_org,source_url,status,source_kind")
    .eq("index_code", indexCode)
    .eq("code", indicatorCode)
    .maybeSingle();
  if (ie) throw new Error(ie.message);
  const i = ind as Record<string, unknown> | null;
  if (!i || i.source_kind !== "evidence" || i.status !== "active")
    throw new Error("Not an active evidence indicator.");

  const { data: crows } = await c.from("countries").select("code,name").not("iso3", "is", null).order("code");
  const countries = (crows ?? []) as Array<{ code: string; name: string }>;
  const { data: done } = await c
    .from("index_evidence")
    .select("country_code")
    .eq("index_code", indexCode)
    .eq("indicator_code", indicatorCode);
  const skip = new Set(((done ?? []) as Array<{ country_code: string }>).map((r) => r.country_code));
  const todo = countries.filter((x) => !skip.has(x.code));
  if (!todo.length) return { drafted: 0, noSource: [] as string[], skippedVerified: skip.size };

  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");
  // small batches: one question about 22 states returns far fewer sourced answers
  const ask = async (batch: typeof todo): Promise<DraftItem[]> => {
    const prompt = `Indicator: ${i.name}
Unit: ${i.unit} (best = ${i.goal_best}, worst = ${i.goal_worst})
Preferred source: ${i.source_org}${i.source_url ? ` (${i.source_url})` : ""}

For each jurisdiction below, find the most recent official value from a primary or authoritative published source
(government, central bank, regulator, or the named international body).
${batch.map((x) => `- ${x.code}: ${x.name}`).join("\n")}

Rules: never guess. If you cannot find a published source that states the value, return value null.
document_url must be the https page or PDF that states the value; quote must be a short verbatim excerpt from it.
period is the 4-digit year the value refers to.
Return STRICT JSON array only: [{"country":"CODE","value":number|null,"period":"YYYY"|null,"document_title":string|null,"document_url":string|null,"document_date":"YYYY-MM-DD"|null,"publisher":string|null,"quote":string|null}]`;
    try {
      const res = await perplexityFetch(
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              {
                role: "system",
                content: "You are a careful public-records researcher. Strict JSON only. No prose.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0,
          }),
        },
        90_000,
      );
      if (!res.ok) return [];
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const m = (j.choices?.[0]?.message?.content ?? "").match(/\[[\s\S]*\]/);
      return z.array(Item).parse(m ? JSON.parse(m[0]) : []) as DraftItem[];
    } catch {
      return [];
    }
  };
  const batches: (typeof todo)[] = [];
  for (let k = 0; k < todo.length; k += 4) batches.push(todo.slice(k, k + 4));
  const items = (await Promise.all(batches.map(ask))).flat();

  const codes = new Set(todo.map((x) => x.code));
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const cc = it.country?.toUpperCase();
    if (!codes.has(cc) || seen.has(cc)) continue;
    const ok = validDraft(it, Number(i.goal_best), Number(i.goal_worst));
    if (!ok) continue;
    seen.add(cc);
    rows.push({
      index_code: indexCode,
      indicator_code: indicatorCode,
      country_code: cc,
      value: it.value,
      period: it.period,
      document_title: it.document_title!.slice(0, 300),
      document_url: it.document_url,
      document_date: it.document_date && /^\d{4}-\d{2}-\d{2}$/.test(it.document_date) ? it.document_date : null,
      publisher: it.publisher!.slice(0, 200),
      grade: "C",
      notes: `AI draft — check the source before verifying. Quote: "${it.quote!.slice(0, 600)}"`,
      entered_by: null,
      verified: false,
      verified_by: null,
      verified_at: null,
      updated_at: now,
    });
  }
  if (rows.length) {
    const { error } = await c
      .from("index_evidence")
      .upsert(rows, { onConflict: "index_code,indicator_code,country_code,period" });
    if (error) throw new Error(error.message);
  }
  return {
    drafted: rows.length,
    noSource: todo.filter((x) => !seen.has(x.code)).map((x) => x.code),
    skippedVerified: skip.size,
  };
}
