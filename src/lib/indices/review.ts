// @domain indices
// @tables none
// @ui src/routes/_authenticated/admin/indices.tsx
//
// Pure review logic for the Caribbean Indices back office. No I/O.
//
//   diffRuns        what changed between two runs: score and rank moves, states
//                   that became (or stopped being) scored, and every input whose
//                   value, period or exclusion changed. This is the "what changed
//                   since last time" view a steward reads before signing off.
//   readinessChecks the publish checklist for a release. Blocking checks stop
//                   publication (publishIndexRelease runs the same function), so
//                   the page and the server can never disagree.

export type Num = number | null;

export interface ScoreLite {
  index_code: string;
  country_code: string;
  status: "scored" | "not_scored";
  score: Num;
  rank: Num;
  sextant_band?: string | null;
}

export interface InputLite {
  index_code: string;
  indicator_code: string;
  country_code: string;
  value_used: Num;
  period: string | null;
  excluded_reason: string | null;
  source_org?: string | null;
}

export interface ScoreChange {
  index_code: string;
  country_code: string;
  kind: "moved" | "newly_scored" | "no_longer_scored" | "new_country" | "dropped_country";
  score_before: Num;
  score_after: Num;
  score_delta: Num;
  rank_before: Num;
  rank_after: Num;
  /** positive = climbed (rank number fell) */
  rank_delta: Num;
}

export interface InputChange {
  index_code: string;
  indicator_code: string;
  country_code: string;
  kind:
    | "value_changed"
    | "period_changed"
    | "now_included"
    | "now_excluded"
    | "exclusion_changed"
    | "added"
    | "removed";
  before: { value: Num; period: string | null; excluded_reason: string | null } | null;
  after: { value: Num; period: string | null; excluded_reason: string | null } | null;
  source_org: string | null;
}

export interface RunDiff {
  scores: ScoreChange[];
  inputs: InputChange[];
  summary: Record<
    string,
    {
      moved: number;
      newly_scored: number;
      no_longer_scored: number;
      inputs_changed: number;
      largest_move: Num;
    }
  >;
}

/** Score moves smaller than this are rounding noise, not news. */
export const SCORE_EPSILON = 0.05;

const sk = (r: { index_code: string; country_code: string }) => `${r.index_code}|${r.country_code}`;
const ik = (r: { index_code: string; indicator_code: string; country_code: string }) =>
  `${r.index_code}|${r.indicator_code}|${r.country_code}`;

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function sameValue(a: Num, b: Num): boolean {
  if (a == null || b == null) return a === b;
  // relative tolerance: source APIs re-serialise floats
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

export function diffRuns(
  current: { scores: ScoreLite[]; inputs: InputLite[] },
  base: { scores: ScoreLite[]; inputs: InputLite[] },
): RunDiff {
  const scores: ScoreChange[] = [];
  const before = new Map(base.scores.map((s) => [sk(s), s]));
  const after = new Map(current.scores.map((s) => [sk(s), s]));

  for (const [k, a] of after) {
    const b = before.get(k);
    const mk = (kind: ScoreChange["kind"]): ScoreChange => ({
      index_code: a.index_code,
      country_code: a.country_code,
      kind,
      score_before: b?.score ?? null,
      score_after: a.score,
      score_delta: b?.score != null && a.score != null ? round(a.score - b.score) : null,
      rank_before: b?.rank ?? null,
      rank_after: a.rank,
      rank_delta: b?.rank != null && a.rank != null ? b.rank - a.rank : null,
    });
    if (!b) {
      scores.push(mk("new_country"));
      continue;
    }
    if (b.status !== "scored" && a.status === "scored") scores.push(mk("newly_scored"));
    else if (b.status === "scored" && a.status !== "scored") scores.push(mk("no_longer_scored"));
    else if (a.status === "scored") {
      const c = mk("moved");
      if (Math.abs(c.score_delta ?? 0) >= SCORE_EPSILON || (c.rank_delta ?? 0) !== 0)
        scores.push(c);
    }
  }
  for (const [k, b] of before) {
    if (after.has(k)) continue;
    scores.push({
      index_code: b.index_code,
      country_code: b.country_code,
      kind: "dropped_country",
      score_before: b.score,
      score_after: null,
      score_delta: null,
      rank_before: b.rank,
      rank_after: null,
      rank_delta: null,
    });
  }

  const inputs: InputChange[] = [];
  const ib = new Map(base.inputs.map((r) => [ik(r), r]));
  const ia = new Map(current.inputs.map((r) => [ik(r), r]));
  const snap = (r: InputLite) => ({
    value: r.value_used,
    period: r.period,
    excluded_reason: r.excluded_reason,
  });
  for (const [k, a] of ia) {
    const b = ib.get(k);
    const base_ = {
      index_code: a.index_code,
      indicator_code: a.indicator_code,
      country_code: a.country_code,
      source_org: a.source_org ?? b?.source_org ?? null,
    };
    if (!b) {
      inputs.push({ ...base_, kind: "added", before: null, after: snap(a) });
      continue;
    }
    const wasIn = b.excluded_reason == null && b.value_used != null;
    const isIn = a.excluded_reason == null && a.value_used != null;
    let kind: InputChange["kind"] | null = null;
    if (!wasIn && isIn) kind = "now_included";
    else if (wasIn && !isIn) kind = "now_excluded";
    else if (!isIn && a.excluded_reason !== b.excluded_reason) kind = "exclusion_changed";
    else if (!sameValue(a.value_used, b.value_used)) kind = "value_changed";
    else if (a.period !== b.period) kind = "period_changed";
    if (kind) inputs.push({ ...base_, kind, before: snap(b), after: snap(a) });
  }
  for (const [k, b] of ib) {
    if (ia.has(k)) continue;
    inputs.push({
      index_code: b.index_code,
      indicator_code: b.indicator_code,
      country_code: b.country_code,
      source_org: b.source_org ?? null,
      kind: "removed",
      before: snap(b),
      after: null,
    });
  }

  const order: Record<ScoreChange["kind"], number> = {
    no_longer_scored: 0,
    newly_scored: 1,
    moved: 2,
    new_country: 3,
    dropped_country: 4,
  };
  scores.sort(
    (x, y) =>
      x.index_code.localeCompare(y.index_code) ||
      order[x.kind] - order[y.kind] ||
      Math.abs(y.score_delta ?? 0) - Math.abs(x.score_delta ?? 0) ||
      x.country_code.localeCompare(y.country_code),
  );
  inputs.sort(
    (x, y) =>
      x.index_code.localeCompare(y.index_code) ||
      x.country_code.localeCompare(y.country_code) ||
      x.indicator_code.localeCompare(y.indicator_code),
  );

  const summary: RunDiff["summary"] = {};
  const codes = new Set([...current.scores, ...base.scores].map((s) => s.index_code));
  for (const code of codes) {
    const sc = scores.filter((s) => s.index_code === code);
    const moves = sc.map((s) => s.score_delta).filter((d): d is number => d != null);
    summary[code] = {
      moved: sc.filter((s) => s.kind === "moved").length,
      newly_scored: sc.filter((s) => s.kind === "newly_scored").length,
      no_longer_scored: sc.filter((s) => s.kind === "no_longer_scored").length,
      inputs_changed: inputs.filter((i) => i.index_code === code).length,
      largest_move: moves.length
        ? moves.reduce((m, d) => (Math.abs(d) > Math.abs(m) ? d : m), 0)
        : null,
    };
  }
  return { scores, inputs, summary };
}

// ------------------------------------------------------------------ readiness

export interface ReadinessFacts {
  release: { kind: string; status: string };
  run: {
    status: string;
    data_cutoff: string;
    stats: { sources?: { failed?: Array<{ indicator: string; error: string }> } } | null;
    /** index code → method version the run scored with (index_runs.method_versions) */
    method_versions?: Record<string, number> | null;
  };
  /** index code → method status */
  methods: Array<{ code: string; method_status: string; method_version: number }>;
  /**
   * Every input that carries a source value (raw_value or value_used set), excluded or not,
   * joined to the indicator's current licence. Published editions redistribute every input row
   * (partner API, MCP), so an excluded value under an unconfirmed licence still counts.
   */
  usedLicences: Array<{
    index_code: string;
    indicator_code: string;
    licence: string | null;
    licence_status: string | null;
    source_org: string | null;
    uses: number;
  }>;
  scored: Record<string, { scored: number; not_scored: number }>;
  unverifiedEvidence: number;
  today: string; // YYYY-MM-DD
}

export interface ReadinessCheck {
  code: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  detail: string | null;
  items?: string[];
}

/** Days after the data cut-off before an edition is flagged as stale. */
export const EDITION_STALE_DAYS = 45;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function readinessChecks(f: ReadinessFacts): { ready: boolean; checks: ReadinessCheck[] } {
  const checks: ReadinessCheck[] = [];

  checks.push({
    code: "kind",
    label: "Release is an official edition",
    ok: f.release.kind === "edition",
    blocking: true,
    detail:
      f.release.kind === "edition"
        ? null
        : "Trackers stay private to governments and are never published.",
  });
  checks.push({
    code: "status",
    label: "Release is not withdrawn",
    ok: f.release.status !== "withdrawn",
    blocking: true,
    detail: f.release.status === "withdrawn" ? "Run a new edition instead." : null,
  });
  checks.push({
    code: "run",
    label: "Run completed",
    ok: f.run.status === "complete",
    blocking: true,
    detail: f.run.status === "complete" ? null : `Run status is ${f.run.status}.`,
  });

  // frozen now AND the run scored with that same frozen version: an edition run under
  // draft v0 must not become publishable because v1 was frozen afterwards.
  const ranWith = f.run.method_versions ?? {};
  const methodProblems = f.methods.flatMap((m) => {
    if (m.method_status !== "frozen")
      return [`${m.code} · method v${m.method_version} is ${m.method_status}`];
    const used = ranWith[m.code];
    if (used == null) return [`${m.code} · the run did not record its method version`];
    if (Number(used) !== m.method_version)
      return [
        `${m.code} · the run used method v${used}; the frozen method is v${m.method_version} — run a new edition`,
      ];
    return [];
  });
  checks.push({
    code: "method",
    label: "Run scored with the frozen method",
    ok: methodProblems.length === 0,
    blocking: true,
    detail: methodProblems.length
      ? "Freeze the method by migration after the methodology panel ratifies the goalposts, then draft the edition under that frozen version."
      : null,
    items: methodProblems,
  });

  const unlicensed = f.usedLicences.filter((l) => l.licence_status !== "confirmed");
  checks.push({
    code: "licences",
    label: "Every input used has a confirmed licence",
    ok: unlicensed.length === 0,
    blocking: true,
    detail: unlicensed.length
      ? `${unlicensed.length} indicator${unlicensed.length === 1 ? " feeds" : "s feed"} this edition under a licence still to confirm. Confirm the terms (or a paid licence) and record it by migration, then re-run.`
      : null,
    items: unlicensed.map(
      (l) =>
        `${l.index_code} · ${l.indicator_code} — ${l.source_org ?? "unknown source"} (${l.licence ?? "no licence recorded"}), ${l.uses} value${l.uses === 1 ? "" : "s"}`,
    ),
  });

  const anyScored = Object.values(f.scored).some((s) => s.scored > 0);
  checks.push({
    code: "scored",
    label: "At least one state is scored",
    ok: anyScored,
    blocking: true,
    detail: anyScored ? null : "No index scored any state; there is nothing to publish.",
    items: Object.entries(f.scored).map(
      ([k, s]) => `${k} · ${s.scored} scored, ${s.not_scored} not scored`,
    ),
  });

  const failed = f.run.stats?.sources?.failed ?? [];
  checks.push({
    code: "sources",
    label: "Every source answered during the run",
    ok: failed.length === 0,
    blocking: false,
    detail: failed.length
      ? "Unreachable sources lower coverage and the Sextant. Consider re-running."
      : null,
    items: failed.map((x) => `${x.indicator}: ${x.error}`),
  });

  const age = daysBetween(f.run.data_cutoff, f.today);
  checks.push({
    code: "fresh",
    label: `Data cut-off within ${EDITION_STALE_DAYS} days`,
    ok: age <= EDITION_STALE_DAYS,
    blocking: false,
    detail:
      age <= EDITION_STALE_DAYS
        ? null
        : `Cut-off was ${age} days ago. A fresh edition run would pick up newer data.`,
  });

  checks.push({
    code: "evidence",
    label: "No evidence waiting for verification",
    ok: f.unverifiedEvidence === 0,
    blocking: false,
    detail: f.unverifiedEvidence
      ? `${f.unverifiedEvidence} evidence entr${f.unverifiedEvidence === 1 ? "y is" : "ies are"} unverified and did not feed this run.`
      : null,
  });

  return { ready: checks.every((c) => c.ok || !c.blocking), checks };
}
