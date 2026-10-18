// Chamber 05 · advanced signal filters, kept in the page address so views can
// be shared or bookmarked.
import { useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignalFilters } from "@/lib/narrative-chamber.functions";
import { SOURCE_TIER_LABEL } from "@/lib/narrative-source-strength";

type Search = Record<string, string | undefined>;

const csv = (v?: string) => (v ? v.split(",").filter(Boolean) : []);

export function filtersFromSearch(s: Search): SignalFilters {
  const f: SignalFilters = {};
  if (s.f_topic === "politics" || s.f_topic === "gdp" || s.f_topic === "both") f.topic = s.f_topic;
  if (s.f_cty) f.countries = csv(s.f_cty);
  if (s.f_tier) f.tiers = csv(s.f_tier).map(Number).filter((n) => n >= 1 && n <= 5);
  if (s.f_scope) f.scopes = csv(s.f_scope) as SignalFilters["scopes"];
  if (s.f_link) f.links = csv(s.f_link) as SignalFilters["links"];
  if (s.f_min && Number(s.f_min) > 0) f.minScore = Number(s.f_min);
  if (s.f_first === "1") f.firstOnly = true;
  if (s.f_multi === "1") f.multiCountry = true;
  if (s.f_src) f.sourceFeedId = s.f_src;
  return f;
}

export const hasFilters = (f: SignalFilters) => Object.keys(f).length > 0;

const PRESETS: Array<{ label: string; hint: string; search: Search }> = [
  { label: "Cabinet watch", hint: "Politics from S1–S2 sources", search: { f_topic: "politics", f_tier: "1,2" } },
  { label: "Economic pulse", hint: "GDP stories scoring 60+", search: { f_topic: "gdp", f_min: "60" } },
  { label: "Regional echo", hint: "Stories shared with other countries", search: { f_multi: "1" } },
];

const KEYS = ["f_topic", "f_cty", "f_tier", "f_scope", "f_link", "f_min", "f_first", "f_multi", "f_src"];

export function useSignalSearch() {
  const search = useSearch({ strict: false }) as Search;
  const navigate = useNavigate();
  const set = (patch: Search) =>
    void navigate({
      to: ".",
      search: ((prev: Search) => {
        const next = { ...prev, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
        return next;
      }) as never,
      replace: true,
    });
  const clear = () => set(Object.fromEntries(KEYS.map((k) => [k, undefined])));
  return { search, set, clear };
}

function Toggle({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
        on ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200 text-ink-600 hover:border-ink-950",
      )}
    >
      {children}
    </button>
  );
}

export function SignalFilterBar({ countryOptions }: { countryOptions: Array<{ code: string; name: string }> }) {
  const { search, set, clear } = useSignalSearch();
  const toggleCsv = (key: string, val: string) => {
    const cur = new Set(csv(search[key]));
    if (cur.has(val)) cur.delete(val);
    else cur.add(val);
    set({ [key]: [...cur].join(",") || undefined });
  };
  const has = (key: string, val: string) => csv(search[key]).includes(val);
  const active = KEYS.filter((k) => search[k]);
  const label = (k: string) => {
    const v = search[k]!;
    switch (k) {
      case "f_topic": return v === "both" ? "Politics + GDP" : v === "gdp" ? "GDP" : "Politics";
      case "f_tier": return csv(v).map((t) => `S${t}`).join(" ");
      case "f_min": return `Score ≥ ${v}`;
      case "f_first": return "First to report";
      case "f_multi": return "Shared with neighbours";
      case "f_cty": return `Mentions ${v}`;
      case "f_src": return "One source";
      default: return v.replace(/,/g, " · ");
    }
  };

  return (
    <div className="space-y-2 border border-line-200 p-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" title={p.hint} className="btn-ghost !px-2 !py-0.5 text-[10px]" onClick={() => { clear(); setTimeout(() => set(p.search), 0); }}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Topic</span>
        {(["politics", "gdp", "both"] as const).map((t) => (
          <Toggle key={t} on={search.f_topic === t} onClick={() => set({ f_topic: search.f_topic === t ? undefined : t })}>
            {t === "both" ? "Both" : t === "gdp" ? "GDP" : "Politics"}
          </Toggle>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Source</span>
        {[1, 2, 3, 4, 5].map((t) => (
          <Toggle key={t} title={SOURCE_TIER_LABEL[t]} on={has("f_tier", String(t))} onClick={() => toggleCsv("f_tier", String(t))}>
            S{t}
          </Toggle>
        ))}
        <Toggle on={search.f_first === "1"} onClick={() => set({ f_first: search.f_first === "1" ? undefined : "1" })}>
          First to report
        </Toggle>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Reach</span>
        {(["local", "regional", "international"] as const).map((s) => (
          <Toggle key={s} on={has("f_scope", s)} onClick={() => toggleCsv("f_scope", s)}>{s}</Toggle>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Link</span>
        {(["verified", "redirected", "broken"] as const).map((s) => (
          <Toggle key={s} on={has("f_link", s)} onClick={() => toggleCsv("f_link", s)}>{s}</Toggle>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
          Min score
          <input
            type="range" min={0} max={90} step={10}
            value={Number(search.f_min ?? 0)}
            onChange={(e) => set({ f_min: e.target.value === "0" ? undefined : e.target.value })}
            className="w-20"
          />
          <span className="tabular-nums text-ink-800">{search.f_min ?? 0}</span>
        </label>
        <Toggle on={search.f_multi === "1"} onClick={() => set({ f_multi: search.f_multi === "1" ? undefined : "1" })}>
          Shared with neighbours
        </Toggle>
        {countryOptions.length > 0 && (
          <select
            aria-label="Mentions country"
            value=""
            onChange={(e) => e.target.value && toggleCsv("f_cty", e.target.value)}
            className="border border-line-200 bg-paper-0 px-1 py-0.5 font-mono text-[9px] uppercase text-ink-700"
          >
            <option value="">Mentions…</option>
            {countryOptions.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-line-100 pt-2">
          {active.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 border border-ink-950 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-950">
              {label(k)}
              <button type="button" aria-label={`Remove ${label(k)}`} onClick={() => set({ [k]: undefined })}><X size={9} /></button>
            </span>
          ))}
          <button type="button" onClick={clear} className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500 underline">Clear all</button>
        </div>
      )}
    </div>
  );
}
