import { describe, expect, test } from "vitest";

import {
  diffRuns,
  readinessChecks,
  type InputLite,
  type ReadinessFacts,
  type ScoreLite,
} from "./review";

const s = (country: string, score: number | null, rank: number | null, idx = "CHX"): ScoreLite => ({
  index_code: idx,
  country_code: country,
  status: score == null ? "not_scored" : "scored",
  score,
  rank,
});
const i = (
  country: string,
  ind: string,
  value: number | null,
  period: string | null = "2024",
  excluded: string | null = null,
): InputLite => ({
  index_code: "CHX",
  indicator_code: ind,
  country_code: country,
  value_used: value,
  period,
  excluded_reason: excluded,
  source_org: "World Bank WDI",
});

describe("diffRuns", () => {
  test("reports moves, rank changes and newly scored states; ignores noise", () => {
    const d = diffRuns(
      {
        scores: [s("BRB", 72.4, 1), s("LCA", 70.0, 2), s("KNA", 60, 3), s("DMA", 55.02, 4)],
        inputs: [],
      },
      {
        scores: [s("BRB", 70.0, 2), s("LCA", 71.0, 1), s("KNA", null, null), s("DMA", 55.0, 4)],
        inputs: [],
      },
    );
    const by = Object.fromEntries(d.scores.map((c) => [c.country_code, c]));
    expect(by.BRB.kind).toBe("moved");
    expect(by.BRB.score_delta).toBe(2.4);
    expect(by.BRB.rank_delta).toBe(1);
    expect(by.LCA.rank_delta).toBe(-1);
    expect(by.KNA.kind).toBe("newly_scored");
    expect(by.DMA).toBeUndefined(); // 0.02 is below the noise floor
    expect(d.summary.CHX).toMatchObject({
      moved: 2,
      newly_scored: 1,
      no_longer_scored: 0,
      largest_move: 2.4,
    });
    // states that lost their score come first
    const d2 = diffRuns(
      { scores: [s("BRB", null, null), s("LCA", 75, 1)], inputs: [] },
      { scores: [s("BRB", 70, 1), s("LCA", 71, 2)], inputs: [] },
    );
    expect(d2.scores[0]).toMatchObject({ country_code: "BRB", kind: "no_longer_scored" });
  });

  test("classifies input changes", () => {
    const d = diffRuns(
      {
        scores: [],
        inputs: [
          i("BRB", "life_expectancy", 77.1),
          i("BRB", "u5_mortality", 12, "2024"),
          i("BRB", "unemployment", 9.1),
          i("BRB", "poverty", null, null, "stale"),
          i("BRB", "internet", 80),
          i("BRB", "tertiary", 61),
        ],
      },
      {
        scores: [],
        inputs: [
          i("BRB", "life_expectancy", 76.9),
          i("BRB", "u5_mortality", 12, "2023"),
          i("BRB", "unemployment", null, null, "source_unreachable"),
          i("BRB", "poverty", 17.2, "2016"),
          i("BRB", "internet", 80.0000000000001),
          i("BRB", "homicide", 10),
        ],
      },
    );
    const by = Object.fromEntries(d.inputs.map((c) => [c.indicator_code, c.kind]));
    expect(by).toEqual({
      life_expectancy: "value_changed",
      u5_mortality: "period_changed",
      unemployment: "now_included",
      poverty: "now_excluded",
      tertiary: "added",
      homicide: "removed",
    });
  });

  test("first run against nothing lists every country as new", () => {
    const d = diffRuns({ scores: [s("BRB", 70, 1)], inputs: [] }, { scores: [], inputs: [] });
    expect(d.scores).toHaveLength(1);
    expect(d.scores[0].kind).toBe("new_country");
  });
});

const facts = (over: Partial<ReadinessFacts> = {}): ReadinessFacts => ({
  release: { kind: "edition", status: "draft" },
  run: { status: "complete", data_cutoff: "2027-03-31", stats: { sources: { failed: [] } } },
  methods: [
    { code: "CHX", method_status: "frozen", method_version: 1 },
    { code: "CGX", method_status: "frozen", method_version: 1 },
  ],
  usedLicences: [
    {
      index_code: "CHX",
      indicator_code: "life_expectancy",
      licence: "CC BY 4.0",
      licence_status: "confirmed",
      source_org: "World Bank WDI",
      uses: 22,
    },
  ],
  scored: { CHX: { scored: 12, not_scored: 10 } },
  unverifiedEvidence: 0,
  today: "2027-04-10",
  ...over,
});

describe("readinessChecks", () => {
  test("a clean edition is ready", () => {
    const r = readinessChecks(facts());
    expect(r.ready).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  test("an unconfirmed licence on a used input blocks publication", () => {
    const r = readinessChecks(
      facts({
        usedLicences: [
          {
            index_code: "CGX",
            indicator_code: "real_growth",
            licence: "IMF terms of use",
            licence_status: "to_confirm",
            source_org: "IMF World Economic Outlook",
            uses: 18,
          },
        ],
      }),
    );
    expect(r.ready).toBe(false);
    const lic = r.checks.find((c) => c.code === "licences")!;
    expect(lic.ok).toBe(false);
    expect(lic.items?.[0]).toContain("CGX · real_growth");
    expect(lic.items?.[0]).toContain("18 values");
  });

  test("draft method, trackers and failed runs block", () => {
    expect(
      readinessChecks(
        facts({ methods: [{ code: "CHX", method_status: "draft", method_version: 0 }] }),
      ).ready,
    ).toBe(false);
    expect(readinessChecks(facts({ release: { kind: "tracker", status: "draft" } })).ready).toBe(
      false,
    );
    expect(
      readinessChecks(facts({ run: { status: "failed", data_cutoff: "2027-03-31", stats: null } }))
        .ready,
    ).toBe(false);
    expect(readinessChecks(facts({ scored: { CHX: { scored: 0, not_scored: 22 } } })).ready).toBe(
      false,
    );
  });

  test("source failures, stale cut-off and pending evidence warn but do not block", () => {
    const r = readinessChecks(
      facts({
        run: {
          status: "complete",
          data_cutoff: "2027-01-01",
          stats: { sources: { failed: [{ indicator: "CHX.x", error: "timeout" }] } },
        },
        unverifiedEvidence: 3,
      }),
    );
    expect(r.ready).toBe(true);
    const warn = r.checks.filter((c) => !c.ok).map((c) => c.code);
    expect(warn.sort()).toEqual(["evidence", "fresh", "sources"]);
  });
});
