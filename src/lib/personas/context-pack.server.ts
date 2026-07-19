// Chamber 07 · Country context assembler for AI grounding.
// Pulls sectors, KPIs, ministries, recent signals, and top matching
// second-brain memory chunks into a single prompt block + citations list.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidCitationUrl } from "@/lib/citations/hygiene";

export interface ContextCitation {
  n: number;
  label: string;
  kind: "sector" | "kpi" | "ministry" | "signal" | "memory" | "source";
  ref?: string;
  url?: string;
  org?: string | null;
  title?: string | null;
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
    { data: memorySources },
    { data: registrySources },
  ] = await Promise.all([
    supabase.from("countries").select("name").eq("code", countryCode).maybeSingle(),
    supabase
      .from("country_sectors")
      .select("sector_code,share_pct,confidence_grade,source_ref")
      .eq("country_code", countryCode)
      .order("share_pct", { ascending: false })
      .limit(10),
    supabase
      .from("country_kpis")
      .select("kpi_code,label,latest_value,unit,target,direction,source_url")
      .eq("country_code", countryCode)
      .limit(15),
    supabase
      .from("ministries")
      .select("name,slug")
      .eq("country_code", countryCode)
      .limit(20),
    supabase
      .from("intake_items")
      .select("topic,summary,final_weight,url")
      .eq("scope_key", countryCode)
      .order("final_weight", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("memory_objects")
      .select("id,title,summary,kind,source_id")
      .eq("scope_key", countryCode)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("sources")
      .select("id,name,url,kind")
      .eq("country_code", countryCode)
      .not("url", "is", null)
      .limit(50),
    supabase
      .from("country_sources")
      .select("id,title,url,org,kind")
      .eq("country_code", countryCode)
      .not("url", "is", null)
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(12),
  ]);

  const countryName = country?.name ?? countryCode;
  const citations: ContextCitation[] = [];
  const sourceById = new Map((memorySources ?? []).map((s) => [String(s.id), s]));
  let n = 0;
  const cite = (c: Omit<ContextCitation, "n">) => {
    if (!isValidCitationUrl(c.url)) return null;
    n += 1;
    citations.push({ ...c, n });
    return n;
  };
  const prefix = (cn: number | null) => (cn ? `[${cn}] ` : "");

  const sectorLines = (sectors ?? []).map((s) => {
    const sourceUrl = isValidCitationUrl(s.source_ref) ? s.source_ref : undefined;
    const cn = cite({ label: `Sector: ${s.sector_code}`, kind: "sector", ref: s.sector_code, url: sourceUrl });
    return `- ${prefix(cn)}${s.sector_code}: ${Number(s.share_pct ?? 0).toFixed(1)}% GDP (grade ${s.confidence_grade ?? "?"})`;
  });
  const kpiLines = (kpis ?? []).map((k) => {
    const cn = cite({ label: `KPI: ${k.label ?? k.kpi_code}`, title: k.label ?? k.kpi_code, kind: "kpi", ref: k.kpi_code, url: k.source_url ?? undefined });
    return `- ${prefix(cn)}${k.kpi_code} ${k.label ?? ""}: ${k.latest_value ?? "—"}${k.unit ? ` ${k.unit}` : ""} (target ${k.target ?? "—"}, dir ${k.direction ?? "—"})`;
  });
  const ministryLines = (ministries ?? []).map((m) => {
    return `- ${m.name} (context only)`;
  });
  const signalLines = (signals ?? []).map((s) => {
    const cn = cite({ label: `Signal: ${s.topic}`, title: s.topic, kind: "signal", url: s.url ?? undefined });
    return `- ${prefix(cn)}${s.topic}${s.summary ? ` — ${String(s.summary).slice(0, 180)}` : ""}`;
  });
  const memoryLines = (memories ?? []).map((m) => {
    const source = m.source_id ? sourceById.get(String(m.source_id)) : null;
    const cn = cite({
      label: `Memory: ${m.title}`,
      title: m.title,
      kind: "memory",
      ref: m.id,
      url: source?.url ?? undefined,
      org: source?.kind ?? null,
    });
    return `- ${prefix(cn)}(${m.kind}) ${m.title}${m.summary ? ` — ${String(m.summary).slice(0, 160)}` : ""}`;
  });
  const sourceLines = (registrySources ?? []).flatMap((s) => {
    const cn = cite({ label: s.title ?? s.url, title: s.title ?? s.url, kind: "source", ref: s.id, url: s.url, org: s.org ?? null });
    return cn ? [`- [${cn}] ${s.title ?? s.url}${s.org ? ` · ${s.org}` : ""}`] : [];
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
    "",
    "PUBLIC SOURCE REGISTRY:",
    sourceLines.join("\n") || "- (none)",
    "",
    "CITATION RULE: cite only bracketed [N] public-source lines. Do not cite context-only lines.",
  ].filter(Boolean);

  return {
    countryCode,
    countryName,
    block: parts.join("\n"),
    citations,
  };
}
