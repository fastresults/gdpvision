import { describe, expect, test } from "vitest";

import { applyWindow, scoreCountry, type IndexSpec, type RawInput } from "./scoring";
import { fixtureObservations, fixtureTarget, scoreForTest, unitHash } from "./testdata";

const ind = (
  code: string,
  pillar: string,
  over: Partial<IndexSpec["indicators"][number]> = {},
) => ({
  code,
  pillar_code: pillar,
  goal_best: 100,
  goal_worst: 0,
  log_scale: false,
  window_kind: "latest" as const,
  band_low: null,
  band_high: null,
  age_tolerance_years: 3,
  weight: 1,
  status: "active" as const,
  ...over,
});

const spec: IndexSpec = {
  code: "CHX",
  method_version: 1,
  aggregation: "geometric",
  pillar_coverage_min: 0.667,
  pillars: [
    { code: "health", weight: 1 },
    { code: "gov", weight: 1 },
  ],
  indicators: [
    ind("life", "health", { goal_best: 85, goal_worst: 60 }),
    ind("vol", "health", { window_kind: "sd10", goal_best: 0.5, goal_worst: 6 }),
    ind("band", "gov", {
      window_kind: "band_distance",
      band_low: 2,
      band_high: 4,
      goal_best: 0,
      goal_worst: 6,
    }),
    ind("mean", "gov", { window_kind: "mean5", status: "pending_source" }),
  ],
};

describe("test fixtures", () => {
  test("are deterministic and land between the goalposts", () => {
    expect(unitHash("CHX.life.BRB")).toBe(unitHash("CHX.life.BRB"));
    expect(unitHash("CHX.life.BRB")).not.toBe(unitHash("CHX.life.LCA"));
    for (const k of ["a", "b", "c", "d"]) {
      const t = fixtureTarget({ goal_best: 85, goal_worst: 60, log_scale: false }, k);
      expect(t).toBeGreaterThanOrEqual(60 + 25 * 0.2 - 1e-9);
      expect(t).toBeLessThanOrEqual(60 + 25 * 0.85 + 1e-9);
    }
  });

  test("each window kind reproduces the target", () => {
    for (const i of spec.indicators) {
      const obs = fixtureObservations(i, `CHX.${i.code}.BRB`, 2026);
      const w = applyWindow(i, obs, 2026)!;
      const target = fixtureTarget(i, `CHX.${i.code}.BRB`);
      expect(w.value).toBeCloseTo(Math.max(0, target), 6);
      expect(w.period).toBe("2025");
    }
  });

  test("fill only what is missing, so every index scores in a test run", () => {
    const raws: RawInput[] = [
      {
        indicator_code: "life",
        observations: [{ period: "2024", value: 77 }],
        grade: "C",
        source_ok: true,
      },
    ];
    expect(scoreCountry(spec, raws, 2026).status).toBe("not_scored");
    const t = scoreForTest(spec, raws, "BRB", 2026);
    expect(t.result.status).toBe("scored");
    expect([...t.fixtures].sort()).toEqual(["band", "mean", "vol"]);
    // the real value is kept
    expect(t.result.inputs.find((x) => x.indicator_code === "life")!.value_used).toBe(77);
    // fixtures are grade D, so the Sextant shows they are weak
    expect(t.result.weakest_grade).toBe("D");
  });
});
