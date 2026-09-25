// Run: bun scripts/standards/check-scoring.ts
// Pure checks for src/lib/standards/scoring.ts and src/lib/investments/readiness.ts.
import assert from "node:assert/strict";

import { computeAudit, parsePeriod, type RequirementInput } from "../../src/lib/standards/scoring";
import { hasContent, readinessScore } from "../../src/lib/investments/readiness";

const NOW = new Date(Date.UTC(2026, 8, 25)); // 25 Sep 2026
let n = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ok  ${name}`);
};

ok("parsePeriod grains", () => {
  assert.equal(parsePeriod("2024")?.grain, "year");
  assert.equal(parsePeriod("FY2024")?.grain, "year");
  assert.equal(parsePeriod("2024-Q3")?.grain, "quarter");
  assert.equal(parsePeriod("Q3 2024")?.grain, "quarter");
  assert.equal(parsePeriod("2024Q3")?.end.toISOString().slice(0, 10), "2024-09-30");
  assert.equal(parsePeriod("2024-07")?.grain, "month");
  assert.equal(parsePeriod("2024M07")?.end.toISOString().slice(0, 10), "2024-07-31");
  assert.equal(parsePeriod("Jul 2024")?.grain, "month");
  assert.equal(parsePeriod("2024/25")?.end.toISOString().slice(0, 10), "2025-06-30");
  assert.equal(parsePeriod("latest"), null);
  assert.equal(parsePeriod(null), null);
});

const req = (o: Partial<RequirementInput>): RequirementInput => ({
  id: o.id ?? "r1",
  standardCode: o.standardCode ?? "IMF_EGDDS",
  reqKey: o.reqKey ?? "gdp",
  label: o.label ?? "GDP",
  clause: null,
  frequency: o.frequency ?? "annual",
  maxLagMonths: o.maxLagMonths ?? 12,
  impact: o.impact ?? "high",
  kpiCodes: o.kpiCodes ?? ["gdp"],
});
const fig = (code: string, period: string, points: string[] = []) => ({
  kpiCode: code,
  label: code,
  latestValue: 1,
  latestPeriod: period,
  sourceUrl: null,
  pointPeriods: points,
});
const run = (
  r: RequirementInput,
  figures: ReturnType<typeof fig>[],
  plans: Parameters<typeof computeAudit>[0]["plans"] = [],
  mappings: Parameters<typeof computeAudit>[0]["mappings"] = [],
) =>
  computeAudit({
    requirements: [r],
    figures,
    plans,
    mappings,
    standardCodes: [r.standardCode],
    now: NOW,
  }).rows[0];

ok("annual, 2025 in Sept 2026 → collected", () =>
  assert.equal(run(req({}), [fig("gdp", "2025")]).status, "collected"),
);
ok("annual, 2024 in Sept 2026 → collected (21 months ≤ 12 lag + 12 period)", () =>
  assert.equal(run(req({}), [fig("gdp", "2024")]).status, "collected"),
);
ok("annual, 2023 in Sept 2026 → stale", () =>
  assert.equal(run(req({}), [fig("gdp", "2023")]).status, "stale"),
);
ok("stale reason states the age in months", () =>
  assert.match(run(req({}), [fig("gdp", "2023")]).reasons[0], /33 months old/),
);
ok("monthly CPI with yearly data → partial, reason names frequency", () => {
  const r = run(req({ frequency: "monthly", maxLagMonths: 2, kpiCodes: ["cpi"] }), [
    fig("cpi", "2025", ["2024", "2023"]),
  ]);
  assert.equal(r.status, "partial");
  assert.equal(r.frequencyMet, false);
  assert.match(r.reasons[0], /yearly; the standard requires monthly/);
});
ok("monthly CPI with monthly points, recent → collected", () =>
  assert.equal(
    run(req({ frequency: "monthly", maxLagMonths: 2, kpiCodes: ["cpi"] }), [
      fig("cpi", "2026-07", ["2026-06", "2026-05"]),
    ]).status,
    "collected",
  ),
);
ok("monthly CPI, monthly points but 5 months old → stale", () =>
  assert.equal(
    run(req({ frequency: "monthly", maxLagMonths: 2, kpiCodes: ["cpi"] }), [
      fig("cpi", "2026-03", ["2026-02"]),
    ]).status,
    "stale",
  ),
);
ok("approved plan does not make a monthly requirement collected", () => {
  const r = run(
    req({ frequency: "monthly", maxLagMonths: 2, kpiCodes: ["cpi"] }),
    [fig("cpi", "2025")],
    [
      {
        id: "p",
        requirementId: "r1",
        status: "approved",
        ownerAgency: "Stats",
        dueDate: "2027-01-01",
        version: 1,
      },
    ],
  );
  assert.equal(r.status, "partial");
  assert.match(r.reasons.join(" "), /approved collection plan covers the remainder/);
});
ok("FATF with no figures: missing → planned once approved, flagged overdue after due date", () => {
  const r0 = req({ standardCode: "FATF", kpiCodes: [], frequency: "continuous", maxLagMonths: 0 });
  assert.equal(run(r0, []).status, "missing");
  assert.equal(
    run(
      r0,
      [],
      [
        {
          id: "p",
          requirementId: "r1",
          status: "draft",
          ownerAgency: null,
          dueDate: null,
          version: 1,
        },
      ],
    ).status,
    "missing",
  );
  const planned = run(
    r0,
    [],
    [
      {
        id: "p",
        requirementId: "r1",
        status: "approved",
        ownerAgency: "FIU",
        dueDate: "2027-03-31",
        version: 1,
      },
    ],
  );
  assert.equal(planned.status, "planned");
  assert.equal(planned.plan?.overdue, false);
  const late = run(
    r0,
    [],
    [
      {
        id: "p",
        requirementId: "r1",
        status: "approved",
        ownerAgency: "FIU",
        dueDate: "2026-06-30",
        version: 1,
      },
    ],
  );
  assert.equal(late.plan?.overdue, true);
});
ok("accepted mapping adds evidence; suggested does not", () => {
  const r0 = req({ kpiCodes: [] });
  assert.equal(
    run(r0, [fig("x", "2025")], [], [{ requirementId: "r1", kpiCode: "x", status: "suggested" }])
      .status,
    "missing",
  );
  const r = run(
    r0,
    [fig("x", "2025")],
    [],
    [{ requirementId: "r1", kpiCode: "x", status: "accepted" }],
  );
  assert.equal(r.status, "collected");
  assert.equal(r.evidence[0].viaMapping, true);
});
ok("two expected figures, one present → partial", () =>
  assert.equal(run(req({ kpiCodes: ["a", "b"] }), [fig("a", "2025")]).status, "partial"),
);
ok("summary weights by impact", () => {
  const out = computeAudit({
    requirements: [
      req({ id: "h", impact: "high", kpiCodes: ["a"] }),
      req({ id: "l", impact: "low", kpiCodes: ["b"] }),
    ],
    figures: [fig("a", "2025")],
    plans: [],
    mappings: [],
    standardCodes: ["IMF_EGDDS"],
    now: NOW,
  });
  assert.equal(out.summary.coveragePct, 50);
  assert.equal(out.summary.weightedPct, 75);
});
ok("hasContent rejects placeholders", () => {
  assert.equal(hasContent("n/a"), false);
  assert.equal(hasContent("  TBD "), false);
  assert.equal(hasContent("ab"), false);
  assert.equal(hasContent("PPP"), true);
});
ok("readiness counts ten", () => {
  const full = {
    sector: "Energy",
    structure: "PPP",
    capex_usd: 4e7,
    summary: "35 MW solar",
    revenue_model: "Availability payments",
    sponsor: "NIA Energy",
    bo_disclosed: true,
    aml_cleared: true,
    es_category: "B",
    climate_alignment: "NDC aligned",
    risks: "Curtailment",
    feasibility_done: true,
    land_secured: true,
  };
  assert.equal(readinessScore(full), 10);
  assert.equal(readinessScore({ ...full, es_category: "b" }), 9);
  assert.equal(readinessScore({ ...full, summary: "" }), 9);
});
console.log(`${n} checks passed`);
