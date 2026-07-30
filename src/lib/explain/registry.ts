// @domain explain
// @tables none
// @ui src/components/explain/Explain.tsx
//
// The rationale registry. Every figure, assumption or model-authored output the
// user might interrogate resolves to one entry here, so the copy is auditable in
// one place rather than scattered through JSX.
//
// Entries are pure: `derive` receives whatever context the surface provides and
// returns substituted lines. No I/O, no randomness, no server calls — hovering
// must never cost a request.

export interface DerivedLine {
  label: string;
  value: string;
  note?: string;
}

export interface Rationale<Ctx = unknown> {
  /** Namespaced key, e.g. "calc.uplift", "calc.chamber.04". */
  key: string;
  title: string;
  /** One line, shown on hover. Keep under ~140 characters. */
  short: string;
  /** Plain-language statement of the formula. */
  formula?: string;
  /** Where the coefficient or rule comes from. */
  basis?: string;
  /** What would change the answer. */
  caveat?: string;
  /** Substituted arithmetic against the user's live configuration. */
  derive?: (ctx: Ctx) => DerivedLine[];
}

const REGISTRY = new Map<string, Rationale<never>>();

export function registerRationales(entries: Array<Rationale<never>>): void {
  for (const e of entries) REGISTRY.set(e.key, e);
}

export function getRationale(key: string): Rationale<never> | undefined {
  return REGISTRY.get(key);
}

export function hasRationale(key: string): boolean {
  return REGISTRY.has(key);
}
