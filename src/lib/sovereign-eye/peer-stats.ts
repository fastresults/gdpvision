// @domain sovereign-eye
// @tables none
// @ui src/components/sovereign-eye/InterpretationPanel.tsx
//
// Pure, deterministic Caribbean peer statistics. No I/O. The AI never decides
// whether a gap exists — only these rules do.

export type RawKpi = {
  id: string;
  country_code: string;
  kpi_code: string;
  label: string;
  unit: string;
  direction: string | null;
  latest_value: number | null;
  latest_period: string | null;
};

export type NormalizedKpi = {
  country_code: string;
  kpi_code: string;
  source_kpi_id: string;
  raw_value: number | null;
  raw_unit: string;
  raw_period: string | null;
  value_std: number | null;
  unit_std: string;
  ref_year: number | null;
  is_projection: boolean;
  excluded_reason: string | null;
  outlier_flag: boolean;
};

export type PeerBenchmark = {
  country_code: string;
  kpi_code: string;
  label: string;
  unit: string;
  direction: string | null;
  value: number;
  ref_year: number | null;
  median: number;
  mad: number;
  peer_min: number;
  peer_max: number;
  n: number;
  rank: number;
  percentile: number;
  z: number | null;
  gap: number;
  meaningful: boolean;
  favourable: boolean | null;
  peer_values: Array<{ code: string; value: number }>;
  period_span: string;
  input_hash: string;
};

export const MIN_PEERS = 5;
export const Z_THRESHOLD = 1.5;
export const STALE_YEARS = 3;
/** Noise floor: a gap smaller than this share of the median is never meaningful. */
export const NOISE_SHARE = 0.05;

export function normalizeUnit(u: string): string {
  let s = (u ?? "").toLowerCase().replace(/[–—]/g, "-").trim();
  s = s.replace(/\bpercent\b/g, "%").replace(/\s+/g, " ");
  s = s.replace(/ of (total )?labour force/, "").replace(/\s*yoy$/, "");
  if (/arrival/.test(s)) return "count";
  if (/^(people|persons)$/.test(s)) return "count";
  if (/^usd( per person)?$/.test(s)) return "usd";
  if (/metric tons( co2)? per capita/.test(s)) return "t/capita";
  if (/^index \(0-1\)$/.test(s)) return "index 0-1";
  return s.replace(/\s/g, "");
}

export function parsePeriod(p: string | null, now = new Date()): { year: number | null; projection: boolean } {
  if (!p) return { year: null, projection: false };
  const m = p.match(/(19|20)\d{2}/);
  const year = m ? Number(m[0]) : null;
  const projection = /proj|forecast|estimate|outlook/i.test(p) || (year != null && year > now.getUTCFullYear());
  return { year, projection };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** Scrub every raw row. Unit groups: rows whose unit differs from the modal unit are excluded. */
export function scrubKpis(rows: RawKpi[], now = new Date()): NormalizedKpi[] {
  const byKpi = new Map<string, RawKpi[]>();
  for (const r of rows) byKpi.set(r.kpi_code, [...(byKpi.get(r.kpi_code) ?? []), r]);
  const out: NormalizedKpi[] = [];
  for (const [, group] of byKpi) {
    const counts = new Map<string, number>();
    for (const r of group) counts.set(normalizeUnit(r.unit), (counts.get(normalizeUnit(r.unit)) ?? 0) + 1);
    const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const parsed = group.map((r) => ({ r, ...parsePeriod(r.latest_period, now) }));
    const years = parsed.filter((p) => p.year != null && !p.projection).map((p) => p.year as number);
    const medYear = years.length ? median(years) : null;
    const norm: NormalizedKpi[] = parsed.map(({ r, year, projection }) => {
      const unit = normalizeUnit(r.unit);
      let reason: string | null = null;
      if (r.latest_value == null || !Number.isFinite(Number(r.latest_value))) reason = "blank value";
      else if (unit !== modal) reason = `unit mismatch (${r.unit})`;
      else if (year == null) reason = "period unparseable";
      else if (projection) reason = "projection, not an observation";
      else if (medYear != null && year < medYear - STALE_YEARS) reason = `stale (${year} vs peer median ${Math.round(medYear)})`;
      return {
        country_code: r.country_code,
        kpi_code: r.kpi_code,
        source_kpi_id: r.id,
        raw_value: r.latest_value,
        raw_unit: r.unit,
        raw_period: r.latest_period,
        value_std: reason ? null : Number(r.latest_value),
        unit_std: modal,
        ref_year: year,
        is_projection: projection,
        excluded_reason: reason,
        outlier_flag: false,
      };
    });
    // Outlier flag for admin review: |robust z| > 3.5.
    const vals = norm.filter((n) => n.value_std != null).map((n) => n.value_std as number);
    if (vals.length >= MIN_PEERS) {
      const med = median(vals);
      const mad = median(vals.map((v) => Math.abs(v - med)));
      if (mad > 0) for (const n of norm) if (n.value_std != null && Math.abs((n.value_std - med) / (1.4826 * mad)) > 3.5) n.outlier_flag = true;
    }
    out.push(...norm);
  }
  return out;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

export function computeBenchmarks(norm: NormalizedKpi[], meta: Map<string, { label: string; unit: string; direction: string | null }>): PeerBenchmark[] {
  const byKpi = new Map<string, NormalizedKpi[]>();
  for (const n of norm) if (n.value_std != null) byKpi.set(n.kpi_code, [...(byKpi.get(n.kpi_code) ?? []), n]);
  const out: PeerBenchmark[] = [];
  for (const [kpi, rows] of byKpi) {
    const vals = rows.map((r) => r.value_std as number);
    const n = vals.length;
    const med = median(vals);
    const mad = median(vals.map((v) => Math.abs(v - med)));
    const sortedDesc = [...vals].sort((a, b) => b - a);
    const years = rows.map((r) => r.ref_year ?? 0).filter(Boolean);
    const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "";
    const peerValues = rows.map((r) => ({ code: r.country_code, value: r.value_std as number })).sort((a, b) => a.value - b.value);
    const inputHash = hash(`${kpi}|${peerValues.map((p) => `${p.code}:${p.value}`).join(",")}`);
    const m = meta.get(kpi);
    for (const r of rows) {
      const v = r.value_std as number;
      const z = mad > 0 ? (v - med) / (1.4826 * mad) : null;
      const gap = v - med;
      const below = vals.filter((x) => x < v).length;
      const ties = vals.filter((x) => x === v).length;
      const dir = m?.direction === "up" ? 1 : m?.direction === "down" ? -1 : 0;
      const meaningful = n >= MIN_PEERS && z != null && Math.abs(z) >= Z_THRESHOLD && Math.abs(gap) > NOISE_SHARE * Math.abs(med);
      out.push({
        country_code: r.country_code,
        kpi_code: kpi,
        label: m?.label ?? kpi,
        unit: m?.unit ?? r.unit_std,
        direction: m?.direction ?? null,
        value: v,
        ref_year: r.ref_year,
        median: med,
        mad,
        peer_min: Math.min(...vals),
        peer_max: Math.max(...vals),
        n,
        rank: sortedDesc.indexOf(v) + 1,
        percentile: ((below + ties / 2) / n) * 100,
        z,
        gap,
        meaningful,
        favourable: dir === 0 || gap === 0 ? null : gap * dir > 0,
        peer_values: peerValues,
        period_span: span,
        input_hash: inputHash,
      });
    }
  }
  return out;
}
