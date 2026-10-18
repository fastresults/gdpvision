import { describe, expect, it } from "vitest";
import { shapeMedia } from "./media";

const now = Date.parse("2026-10-18T00:00:00Z");
const base = { id: "a", topic: "T", url: "https://x", created_at: "2026-10-10T00:00:00Z", state: "pending", recommendation: "lead", severity: 5, flag_note: "secret", is_political: true };

describe("media sharing", () => {
  it("drops items marked Noise", () => {
    expect(shapeMedia([{ ...base, review_verdict: "noise" }], { now })).toHaveLength(0);
  });
  it("drops items older than 30 days", () => {
    expect(shapeMedia([{ ...base, created_at: "2026-09-10T00:00:00Z" }], { now })).toHaveLength(0);
  });
  it("never returns internal notes or recommendations", () => {
    const [s] = shapeMedia([base], { now });
    expect(s).not.toHaveProperty("flag_note");
    expect(s).not.toHaveProperty("recommendation");
    expect(s.priority_level).toBe(1);
  });
  it("filters by topic", () => {
    expect(shapeMedia([base], { now, topic: "gdp" })).toHaveLength(0);
  });
});
