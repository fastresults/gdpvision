// Chamber 07 · Ministers track — the deterministic count behind every
// Ideal Minister Profile. Client-safe and model-free: the same 50 personas
// always give the same numbers, so each figure on the profile can answer
// "why this number".

import {
  OCEAN_KEYS,
  SKILL_FAMILIES,
  STYLE_KEYS,
  type Aggregates,
  type Band,
  type MatrixAxis,
  type PersonaRow,
  type SkillRow,
} from "./db";

const round = (v: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function band(values: number[]): Band {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return { mean: 0, sd: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0 };
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length);
  return {
    mean: round(mean, 1),
    sd: round(sd, 1),
    min: xs[0]!,
    p25: round(quantile(xs, 0.25), 1),
    median: round(quantile(xs, 0.5), 1),
    p75: round(quantile(xs, 0.75), 1),
    max: xs[xs.length - 1]!,
  };
}

function tally(values: string[]): Array<{ value: string; count: number }> {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = v.trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

const normValue = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function computeAggregates(
  personas: PersonaRow[],
  skills: SkillRow[],
  axes: MatrixAxis[],
): Aggregates {
  const n = personas.length;
  const byCode = new Map(skills.map((s) => [s.code, s]));

  const held = new Map<string, number[]>();
  for (const p of personas) {
    const seen = new Set<string>();
    for (const s of p.skills ?? []) {
      if (!byCode.has(s.code) || seen.has(s.code)) continue;
      seen.add(s.code);
      const prof = Math.min(5, Math.max(1, Math.round(Number(s.proficiency) || 0)));
      const l = held.get(s.code) ?? [];
      l.push(prof);
      held.set(s.code, l);
    }
  }

  const skillAgg = skills
    .map((s) => {
      const profs = held.get(s.code) ?? [];
      const count = profs.length;
      const frequency = n ? count / n : 0;
      const mean = count ? profs.reduce((a, b) => a + b, 0) / count : 0;
      return {
        code: s.code,
        family: s.family,
        label: s.label,
        count,
        frequency: round(frequency, 3),
        mean_proficiency: round(mean, 2),
        weight: round((frequency * mean) / 5, 3),
      };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.label.localeCompare(b.label));

  const families = SKILL_FAMILIES.map((family) => {
    const xs = skillAgg.filter((s) => s.family === family);
    return {
      family,
      skills: xs.length,
      weight: round(
        xs.reduce((sum, s) => sum + s.weight, 0) /
          Math.max(1, skills.filter((s) => s.family === family).length),
        3,
      ),
    };
  });

  const ocean = Object.fromEntries(
    OCEAN_KEYS.map((k) => [k, band(personas.map((p) => Number(p.ocean?.[k])))]),
  ) as Aggregates["ocean"];
  const style = Object.fromEntries(
    STYLE_KEYS.map((k) => [k, band(personas.map((p) => Number(p.decision_style?.[k])))]),
  ) as Aggregates["style"];

  const mix: Aggregates["mix"] = {};
  for (const a of axes) mix[a.key] = tally(personas.map((p) => p.matrix_cell?.[a.key] ?? ""));
  mix.career_route_stated = tally(personas.map((p) => p.career_route));

  const values = tally(
    personas.flatMap((p) => [
      ...new Set((p.attributes?.values ?? []).map((v) => normValue(String(v))).filter(Boolean)),
    ]),
  ).slice(0, 25);

  return {
    personas: n,
    skills: skillAgg,
    families,
    ocean,
    style,
    mix,
    values,
    computed_at: new Date().toISOString(),
  };
}

/** The ranked skill list a synthesis must tier: the top N by weight. */
export function topSkills(a: Aggregates, n = 24) {
  return a.skills.slice(0, n);
}
