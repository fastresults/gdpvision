import { describe, expect, it } from "vitest";
import { computeSourceStrength, credibilityFromStrength, tierFor, SOURCE_PRIOR } from "./narrative-source-strength";

const base = {
  scope: "local",
  active: true,
  consecutive_failures: 0,
  reach_tier: 3,
  admin_weight: 1,
  items: 0,
  relevant: 0,
  hits: 0,
  primaries: 0,
  followed: 0,
  broken: 0,
  dismissed: 0,
  confirmed: 0,
};

describe("source strength", () => {
  it("gives a new source with no history the neutral starting score", () => {
    expect(computeSourceStrength(base).strength).toBe(SOURCE_PRIOR);
  });
  it("makes a widely-read source whose stories are always urgent, first and followed an S1", () => {
    const r = computeSourceStrength({ ...base, reach_tier: 5, items: 60, relevant: 60, hits: 60, primaries: 60, followed: 60 });
    expect(r.strength).toBe(100);
    expect(r.tier).toBe(1);
  });
  it("halves a switched-off source", () => {
    expect(computeSourceStrength({ ...base, active: false }).strength).toBe(SOURCE_PRIOR / 2);
  });
  it("lets an admin boost by up to 1.5x", () => {
    expect(computeSourceStrength({ ...base, admin_weight: 1.5 }).strength).toBe(60);
  });
  it("lowers a source whose stories admins dismiss as noise", () => {
    const clean = computeSourceStrength({ ...base, items: 30, relevant: 30, hits: 10 });
    const noisy = computeSourceStrength({ ...base, items: 30, relevant: 30, hits: 10, dismissed: 10 });
    expect(noisy.strength).toBeLessThan(clean.strength);
  });
  it("maps tiers at 75 / 55 / 35 / 20", () => {
    expect([80, 60, 40, 25, 10].map(tierFor)).toEqual([1, 2, 3, 4, 5]);
  });
  it("maps strength to article credibility 1–5", () => {
    expect(credibilityFromStrength(0)).toBe(1);
    expect(credibilityFromStrength(100)).toBe(5);
  });
});
