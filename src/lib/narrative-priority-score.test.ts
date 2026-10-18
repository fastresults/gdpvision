import { describe, expect, it } from "vitest";
import { computePriorityScore, credibilityFor } from "./narrative-priority-score";

const base = {
  severity: 1,
  reach: 1,
  is_political: false,
  is_economic: false,
  credibility: 1,
  spread: 1,
  mentions_government: false,
  age_hours: 1000,
};

describe("narrative priority score", () => {
  it("scores the weakest possible article at 0", () => {
    expect(computePriorityScore(base).score).toBe(0);
  });
  it("scores the strongest possible article at 100", () => {
    expect(
      computePriorityScore({
        severity: 5,
        reach: 5,
        is_political: true,
        is_economic: true,
        credibility: 5,
        spread: 5,
        mentions_government: true,
        age_hours: 0,
      }).score,
    ).toBe(100);
  });
  it("adds 10 points each for politics and GDP/economy", () => {
    expect(computePriorityScore({ ...base, is_political: true }).score).toBe(10);
    expect(computePriorityScore({ ...base, is_political: true, is_economic: true }).score).toBe(20);
  });
  it("ranks a story carried by more outlets higher", () => {
    expect(computePriorityScore({ ...base, spread: 3 }).score).toBeGreaterThan(
      computePriorityScore({ ...base, spread: 1 }).score,
    );
  });
  it("treats official domains as most credible", () => {
    expect(credibilityFor({ domain: "imf.org" })).toBe(5);
    expect(credibilityFor({ domain: "ab.gov.ag" })).toBe(5);
    expect(credibilityFor({ domain: "localpaper.com", feedScope: "local" })).toBe(3);
  });
});
