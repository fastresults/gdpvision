import { describe, expect, test } from "vitest";

import {
  applyWindow,
  rankScores,
  scoreCountry,
  scoreValue,
  sextantBand,
  type IndexSpec,
  type RawInput,
} from "./scoring";

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
  code: "TST",
  method_version: 0,
  aggregation: "geometric",
  pillar_coverage_min: 0.667,
  pillars: [
    { code: "a", weight: 1 },
    { code: "b", weight: 1 },
  ],
  indicators: [
    ind("a1", "a"),
    ind("a2", "a"),
    ind("a3", "a"),
    ind("b1", "b"),
    ind("b2", "b", { goal_best: 0, goal_worst: 50 }),
  ],
};

const raw = (
  code: string,
  value: number,
  period = "2025",
  grade: RawInput["grade"] = "C",
): RawInput => ({
  indicator_code: code,
  observations: [{ period, value }],
  grade,
  source_ok: true,
});

describe("scoreValue", () => {
  test("higher is better", () =>
    expect(scoreValue({ goal_best: 100, goal_worst: 0, log_scale: false }, 25)).toBe(25));
  test("lower is better", () =>
    expect(scoreValue({ goal_best: 0, goal_worst: 50, log_scale: false }, 10)).toBe(80));
  test("clips to 0–100", () => {
    expect(scoreValue({ goal_best: 10, goal_worst: 0, log_scale: false }, 20)).toBe(100);
    expect(scoreValue({ goal_best: 10, goal_worst: 0, log_scale: false }, -5)).toBe(0);
  });
  test("log scale", () =>
    expect(scoreValue({ goal_best: 100000, goal_worst: 1000, log_scale: true }, 10000)).toBe(50));
  test("log of non-positive is unscorable", () =>
    expect(scoreValue({ goal_best: 10, goal_worst: 1, log_scale: true }, 0)).toBeNull());
});

describe("applyWindow", () => {
  const series = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y, i) => ({
    period: String(y),
    value: i,
  }));
  test("latest ignores years after the cut-off (projections)", () => {
    const w = applyWindow(
      { window_kind: "latest", band_low: null, band_high: null },
      [...series, { period: "2027", value: 99 }],
      2025,
    );
    expect(w).toEqual({ value: 9, period: "2025", method: "reported" });
  });
  test("mean5", () =>
    expect(
      applyWindow({ window_kind: "mean5", band_low: null, band_high: null }, series, 2025)?.value,
    ).toBe(7));
  test("sd10 needs most of the window", () => {
    expect(
      applyWindow({ window_kind: "sd10", band_low: null, band_high: null }, series.slice(5), 2025),
    ).toBeNull();
    expect(
      applyWindow({ window_kind: "sd10", band_low: null, band_high: null }, series, 2025)?.value,
    ).toBeCloseTo(3.0277, 3);
  });
  test("band distance is zero inside the band", () => {
    expect(
      applyWindow(
        { window_kind: "band_distance", band_low: 2, band_high: 4 },
        [{ period: "2025", value: 3 }],
        2025,
      )?.value,
    ).toBe(0);
    expect(
      applyWindow(
        { window_kind: "band_distance", band_low: 2, band_high: 4 },
        [{ period: "2025", value: 7 }],
        2025,
      )?.value,
    ).toBe(3);
    expect(
      applyWindow(
        { window_kind: "band_distance", band_low: 2, band_high: 4 },
        [{ period: "2025", value: -1 }],
        2025,
      )?.value,
    ).toBe(3);
  });
});

describe("scoreCountry", () => {
  test("geometric mean of pillar means", () => {
    const r = scoreCountry(
      spec,
      [raw("a1", 80), raw("a2", 60), raw("a3", 70), raw("b1", 40), raw("b2", 10)],
      2025,
    );
    expect(r.pillar_scores).toEqual({ a: 70, b: 60 });
    expect(r.score).toBe(64.8); // sqrt(70 × 60)
    expect(r.status).toBe("scored");
  });

  test("a pillar below two-thirds coverage means not scored — nothing imputed", () => {
    const r = scoreCountry(spec, [raw("a1", 80), raw("b1", 40), raw("b2", 10)], 2025);
    expect(r.pillar_scores.a).toBeNull();
    expect(r.score).toBeNull();
    expect(r.status).toBe("not_scored");
    expect(r.not_scored_reason).toContain("a");
  });

  test("two of three is enough", () => {
    const r = scoreCountry(
      spec,
      [raw("a1", 80), raw("a2", 60), raw("b1", 40), raw("b2", 10)],
      2025,
    );
    expect(r.pillar_scores.a).toBe(70);
    expect(r.status).toBe("scored");
  });

  test("stale and ungraded inputs are excluded with a reason", () => {
    const r = scoreCountry(
      spec,
      [raw("a1", 80, "2019"), raw("a2", 60, "2025", null), raw("a3", 70)],
      2025,
    );
    const byCode = Object.fromEntries(r.inputs.map((i) => [i.indicator_code, i.excluded_reason]));
    expect(byCode.a1).toBe("stale");
    expect(byCode.a2).toBe("grade_outside_A_D");
    expect(byCode.a3).toBeNull();
    expect(byCode.b1).toBe("not_collected");
  });

  test("pending sources never score", () => {
    const s: IndexSpec = {
      ...spec,
      indicators: spec.indicators.map((i) =>
        i.code === "a3" ? { ...i, status: "pending_source" as const } : i,
      ),
    };
    const r = scoreCountry(s, [raw("a3", 70)], 2025);
    expect(r.inputs.find((i) => i.indicator_code === "a3")?.excluded_reason).toBe("pending_source");
  });

  test("weakest grade and sextant", () => {
    const r = scoreCountry(
      spec,
      [
        raw("a1", 80, "2025", "A"),
        raw("a2", 60, "2025", "D"),
        raw("a3", 70),
        raw("b1", 40),
        raw("b2", 10),
      ],
      2025,
    );
    expect(r.weakest_grade).toBe("D");
    expect(r.sextant_parts.availability).toBe(100);
    expect(r.sextant).toBeGreaterThan(0);
    expect(r.sextant).toBeLessThanOrEqual(100);
  });

  test("deterministic", () => {
    const rs = [raw("a1", 80), raw("a2", 60), raw("a3", 70), raw("b1", 40), raw("b2", 10)];
    expect(scoreCountry(spec, rs, 2025)).toEqual(scoreCountry(spec, [...rs].reverse(), 2025));
  });
});

describe("helpers", () => {
  test("sextant bands", () => {
    expect(sextantBand(85)).toBe("clear");
    expect(sextantBand(60)).toBe("fair");
    expect(sextantBand(45)).toBe("hazy");
    expect(sextantBand(10)).toBe("obscured");
  });
  test("competition ranking", () => {
    const m = rankScores([
      { country_code: "A", score: 70 },
      { country_code: "B", score: 80 },
      { country_code: "C", score: 70 },
      { country_code: "D", score: null },
      { country_code: "E", score: 50 },
    ]);
    expect([m.get("B"), m.get("A"), m.get("C"), m.get("E"), m.get("D")]).toEqual([
      1,
      2,
      2,
      4,
      undefined,
    ]);
  });
});
