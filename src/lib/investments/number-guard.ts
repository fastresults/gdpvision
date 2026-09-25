// @domain investments
// @tables none
// @ui src/components/investments/packages/InvestorPackagesPanel.tsx
//
// The number guard. Pure.
//
// Every figure a model writes into an investor package must already exist in
// the facts the package was generated from. This module pulls every number out
// of generated text — amounts, percentages, years, plain counts — normalises
// its scale (40,000,000 = 40m = US$40 million), and looks for a fact within the
// rounding the text itself implies ("3.5%" accepts a fact of 3.46; "US$40
// million" accepts 39.6m–40.4m). Anything it cannot match is bracketed in the
// text as "[unverified: …]" and listed as a warning, so a reviewer sees it
// before approval and an investor never reads an invented figure as fact.
//
// Deliberately not flagged: integers 0–10 written without a unit (list counts,
// "Performance Standard 1"), ordinals, and numbers that are part of a named
// standard or clause ("FATF R.24", "Recommendation 24", "ISO 14001", "PS1").
// Numbers written as words ("forty million") are not detected.

import type { PackageFacts } from "./package-schema";

export interface NumberToken {
  raw: string;
  start: number;
  end: number;
  value: number;
  /** Half a unit in the last digit written, at the written scale. */
  tolerance: number;
  kind: "money" | "percent" | "year" | "plain";
}

export interface FactNumbers {
  values: number[];
  years: Set<number>;
}

const SCALE: Record<string, number> = {
  thousand: 1e3,
  k: 1e3,
  million: 1e6,
  mn: 1e6,
  m: 1e6,
  mm: 1e6,
  billion: 1e9,
  bn: 1e9,
  b: 1e9,
  trillion: 1e12,
  tn: 1e12,
};

// currency? number scale? percent?
// Scale words may follow a space; single-letter abbreviations must be attached ("40m", not "40 m").
const TOKEN_RE =
  /(US\s?\$|EC\s?\$|XCD\s?|USD\s?|US dollars\s?|\$|£|€)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?(?:thousand|million|billion|trillion|mn|bn|tn)\b|(?:mm|m|k|b)\b)?(\s?(?:%|per\s?cent\b|percent\b))?/gi;

/** Words that make the following integer a reference, not a quantity. */
const REFERENCE_BEFORE =
  /(?:\b(?:recommendation|standard|principle|article|section|rule|chapter|annex|appendix|schedule|phase|category|tier|level|no\.?|number|iso|ps|folder|item|slide|page|version|v)\s*|[A-Za-z]\.?)$/i;

const ORDINAL_AFTER = /^(?:st|nd|rd|th)\b/i;

function parseToken(m: RegExpExecArray): NumberToken | null {
  const [raw, cur, num, scaleRaw, pct] = m;
  const start = m.index;
  const end = start + raw.length;
  const clean = num.replace(/,/g, "");
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  const decimals = clean.includes(".") ? clean.split(".")[1].length : 0;
  const scaleKey = scaleRaw ? scaleRaw.trim().toLowerCase() : "";
  const mult = scaleKey ? (SCALE[scaleKey] ?? 1) : 1;
  const value = n * mult;
  // Trailing zeros on a whole number read as rounding ("48,000" for 47,755),
  // but never below two significant figures ("2,000" does not cover 1,600).
  let places = -decimals;
  if (decimals === 0) {
    const digits = clean.replace(/^0+/, "");
    const trailing = digits.length - digits.replace(/0+$/, "").length;
    places = Math.max(0, Math.min(trailing, digits.length - 2));
  }
  const tolerance = 0.5 * Math.pow(10, places) * mult + 1e-9;
  let kind: NumberToken["kind"] = "plain";
  if (pct) kind = "percent";
  else if (cur) kind = "money";
  else if (
    !scaleKey &&
    decimals === 0 &&
    !num.includes(",") &&
    /^\d{4}$/.test(clean) &&
    n >= 1900 &&
    n <= 2100
  )
    kind = "year";
  return { raw, start, end, value, tolerance, kind };
}

/** Every number in a string, before any skip rules. Used on the facts side. */
function allNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text))) {
    const t = parseToken(m);
    if (t) out.push(t);
  }
  return out;
}

/** Numbers in generated text that make a factual claim. */
export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text))) {
    const t = parseToken(m);
    if (!t) continue;
    const before = text.slice(Math.max(0, t.start - 24), t.start);
    const after = text.slice(t.end, t.end + 3);
    // Already bracketed by an earlier pass.
    if (/\[unverified:[^\]]*$/i.test(text.slice(Math.max(0, t.start - 80), t.start))) continue;
    if (t.kind === "plain" || t.kind === "year") {
      if (REFERENCE_BEFORE.test(before)) continue;
      if (ORDINAL_AFTER.test(after)) continue;
    }
    if (
      t.kind === "plain" &&
      Number.isInteger(t.value) &&
      t.value >= 0 &&
      t.value <= 10 &&
      !t.raw.includes(".")
    )
      continue;
    out.push(t);
  }
  return out;
}

/** Every number and year the facts contain, from values, displays, labels and periods. */
export function collectFactNumbers(facts: PackageFacts): FactNumbers {
  const values: number[] = [];
  const years = new Set<number>();
  const addText = (s: string | null | undefined, yearsOnly = false) => {
    if (!s) return;
    for (const t of yearsOnly ? [] : allNumbers(s)) {
      values.push(t.value);
      if (Number.isInteger(t.value) && t.value >= 1900 && t.value <= 2100) years.add(t.value);
    }
    // Periods such as "2023Q4" or "FY2023/24" hide years behind letters.
    for (const y of s.match(/(?<!\d)(19|20)\d{2}(?!\d)/g) ?? []) years.add(Number(y));
  };
  for (const f of Object.values(facts.items ?? {})) {
    if (typeof f.value === "number" && Number.isFinite(f.value)) values.push(f.value);
    if (typeof f.value === "string") addText(f.value);
    addText(f.display);
    addText(f.label);
    // A period is a date, not a quantity: it can license a year, never an amount.
    addText(f.period ?? null, true);
  }
  addText(facts.project_title);
  return { values, years };
}

export function isVerified(t: NumberToken, facts: FactNumbers): boolean {
  if (t.kind === "year" && facts.years.has(t.value)) return true;
  const v = Math.abs(t.value);
  return facts.values.some((f) => Math.abs(Math.abs(f) - v) <= t.tolerance);
}

/** Bracket every unverified number in one string. */
export function guardText(
  text: string,
  facts: FactNumbers,
): { text: string; unverified: string[] } {
  const bad = extractNumbers(text).filter((t) => !isVerified(t, facts));
  if (bad.length === 0) return { text, unverified: [] };
  let out = text;
  for (const t of [...bad].reverse()) {
    const raw = t.raw.trim();
    const lead = t.raw.length - t.raw.trimStart().length;
    const s = t.start + lead;
    out = `${out.slice(0, s)}[unverified: ${raw}]${out.slice(s + raw.length)}`;
  }
  return { text: out, unverified: bad.map((t) => t.raw.trim()) };
}

/**
 * Guard every string in a value, recursively. `location` names the place in
 * the document so a warning can say where the number is. Keys listed in
 * `skipKeys` are left untouched (identifiers such as fact_keys).
 */
export function guardDeep<T>(
  value: T,
  facts: FactNumbers,
  location: string,
  warnings: string[],
  skipKeys: ReadonlySet<string> = new Set(["fact_keys", "fact_key", "key", "visual", "id"]),
): T {
  if (typeof value === "string") {
    const r = guardText(value, facts);
    for (const u of r.unverified)
      warnings.push(`“${u}” in ${location} does not match any figure in the facts.`);
    return r.text as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => guardDeep(v, facts, location, warnings, skipKeys)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = skipKeys.has(k) ? v : guardDeep(v, facts, location, warnings, skipKeys);
    }
    return out as T;
  }
  return value;
}
