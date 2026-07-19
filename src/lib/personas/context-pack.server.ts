// Chamber 07 · Country context assembler for AI grounding.
// Pulls sectors, KPIs, ministries, recent signals, and top matching
// second-brain memory chunks into a single prompt block + citations list.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContextCitation {
  n: number;
  label: string;
  kind: "sector" | "kpi" | "ministry" | "signal" | "memory" | "source";
  ref?: string;
  url?: string;
}

export interface CountryContextPack {
  countryCode: string;
  countryName: string;
  block: string;
  citations: ContextCitation[];
}

export async function buildCountryContextPack(
  supabase: SupabaseClient,
  countryCode: string,
  focus?: string | null,
): Promise<CountryContextPack> {
  const [
    { data: country },
    { data: sectors },
    { data: kpis },
    { data: ministries },
    { data: signals },
    { data: memories },
  ] = await Promise.all([
    supabase.from("countries").select("name").eq("code", countryCode).maybeSingle(),
    supabase
      .from("country_sectors")
      .select("sector_code,share_pct,confidence_grade")
      .eq("country_code", countryCode)
      .order("share_pct", { ascending: false })
      .limit(10),
    supabase
      .from("country_kpis")
      .select("kpi_code,label,latest_value,unit,target,direction")
      .eq("country_code", countryCode)
      .limit(15),
    supabase
      .from("ministries")
      .select("name,slug")
      .eq("country_code", countryCode)
      .limit(20),
    supabase
      .from("intake_items")
      .select("topic,summary,final_weight")
      .eq("scope_key", countryCode)
      .order("final_weight", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("memory_objects")
      .select("id,title,summary,kind")
      .eq("country_code", countryCode)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const countryName = country?.name ?? countryCode;
  const citations: ContextCitation[] = [];
  let n = 0;
  const cite = (c: Omit<ContextCitation, "n">) => {
    n += 1;
    citations.push({ ...c, n });
    return n;
  };

  const sectorLines = (sectors ?? []).map((s) => {
    const cn = cite({ label: `Sector: ${s.sector_code}`, kind: "sector", ref: s.sector_code });
    return `- [${cn}] ${s.sector_code}: ${Number(s.share_pct ?? 0).toFixed(1)}% GDP (grade ${s.confidence_grade ?? "?"})`;
  });
  const kpiLines = (kpis ?? []).map((k) => {
    const cn = cite({ label: `KPI: ${k.label ?? k.kpi_code}`, kind: "kpi", ref: k.kpi_code });
    return `- [${cn}] ${k.kpi_code} ${k.label ?? ""}: ${k.latest_value ?? "—"}${k.unit ? ` ${k.unit}` : ""} (target ${k.target ?? "—"}, dir ${k.direction ?? "—"})`;
  });
  const ministryLines = (ministries ?? []).map((m) => {
    const cn = cite({ label: `Ministry: ${m.name}`, kind: "ministry", ref: m.slug });
    return `- [${cn}] ${m.name}`;
  });
  const signalLines = (signals ?? []).map((s) => {
    const cn = cite({ label: `Signal: ${s.topic}`, kind: "signal" });
    return `- [${cn}] ${s.topic}${s.summary ? ` — ${String(s.summary).slice(0, 180)}` : ""}`;
  });
  const memoryLines = (memories ?? []).map((m) => {
    const cn = cite({ label: `Memory: ${m.title}`, kind: "memory", ref: m.id });
    return `- [${cn}] (${m.kind}) ${m.title}${m.summary ? ` — ${String(m.summary).slice(0, 160)}` : ""}`;
  });

  const parts = [
    `COUNTRY: ${countryName} (${countryCode})`,
    focus?.trim() ? `FOCUS: ${focus.trim()}` : "",
    "",
    "SECTOR COMPOSITION:",
    sectorLines.join("\n") || "- (none)",
    "",
    "KEY KPIs:",
    kpiLines.join("\n") || "- (none)",
    "",
    "MINISTRIES:",
    ministryLines.join("\n") || "- (none)",
    "",
    "RECENT SIGNALS:",
    signalLines.join("\n") || "- (none)",
    "",
    "SECOND-BRAIN MEMORY (recent):",
    memoryLines.join("\n") || "- (none)",
  ].filter(Boolean);

  return {
    countryCode,
    countryName,
    block: parts.join("\n"),
    citations,
  };
}
