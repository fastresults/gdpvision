import { describe, expect, it } from "vitest";
import { pickGuaranteedP1, type GuaranteeSignal } from "./narrative-p1-guarantee";

const s = (id: string, p: Partial<GuaranteeSignal>): GuaranteeSignal => ({
  id, recommendation: "monitor", severity: 2, reach: 2, is_political: false, is_economic: true,
  priority_score: 10, created_at: "2026-10-18T00:00:00Z", ...p,
});
// lead+sev4 → P1, lead+sev2 → P2, amplify sev2 → P3, monitor → P4, ignore → P5

describe("pickGuaranteedP1", () => {
  it("keeps a natural P1 without raising", () => {
    const r = pickGuaranteedP1([s("a", { recommendation: "lead", severity: 4 }), s("b", {})], "gdp");
    expect(r).toEqual({ status: "natural", id: "a" });
  });
  it("prefers a P2 over a higher-scored P3", () => {
    const r = pickGuaranteedP1([
      s("p3", { recommendation: "amplify", priority_score: 90 }),
      s("p2", { recommendation: "lead", priority_score: 20 }),
    ], "gdp");
    expect(r).toEqual({ status: "raised", id: "p2", from: 2 });
  });
  it("falls through to P4", () => {
    expect(pickGuaranteedP1([s("p4", {})], "gdp")).toEqual({ status: "raised", id: "p4", from: 4 });
  });
  it("never raises a P5", () => {
    expect(pickGuaranteedP1([s("p5", { recommendation: "ignore" })], "gdp")).toEqual({ status: "gap" });
  });
  it("never raises noise", () => {
    expect(pickGuaranteedP1([s("n", { review_verdict: "noise" })], "gdp")).toEqual({ status: "gap" });
  });
  it("one dual-topic story covers both topics", () => {
    const rows = [s("d", { is_political: true, is_economic: true })];
    expect(pickGuaranteedP1(rows, "gdp")).toMatchObject({ id: "d" });
    expect(pickGuaranteedP1(rows, "politics")).toMatchObject({ id: "d" });
  });
  it("reports a gap when no topic match exists", () => {
    expect(pickGuaranteedP1([s("x", {})], "politics")).toEqual({ status: "gap" });
  });
});
