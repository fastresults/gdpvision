import { describe, expect, it } from "vitest";

import { PRESS_CLASSIFIER_MODEL, SCAN_LIMITS, canStartAi, gatewayOutcome, newBudget, offTopicReason } from "./press-scan-rules";

describe("news scan cost rules", () => {
  it("sorts stories with the low-cost model, not the premium one", () => {
    expect(PRESS_CLASSIFIER_MODEL).toBe("google/gemini-3.1-flash-lite");
  });

  it("skips clearly off-topic sports stories before AI", () => {
    expect(offTopicReason("Cuba beats Venezuela in baseball classic", null)).toBe("sports");
    expect(offTopicReason("Premier League: Arsenal win at home", null)).toBe("sports");
    expect(offTopicReason("Tonight's lotto winning numbers", null)).toBe("lifestyle");
  });

  it("keeps off-topic-looking stories that mention politics or the economy", () => {
    expect(offTopicReason("Government budget sets aside $40m for new cricket stadium", null)).toBeNull();
    expect(offTopicReason("Minister says World Cup boosted investment", null)).toBeNull();
    expect(offTopicReason("Hurricane damages hotels across the island", null)).toBeNull();
  });

  it("stops starting AI work once the per-scan limit is used", () => {
    const b = newBudget(2, 0);
    expect(canStartAi(b, 1)).toBe(true);
    b.remaining = 0;
    expect(canStartAi(b, 1)).toBe(false);
  });

  it("stops starting AI work after the one-minute time budget", () => {
    const b = newBudget(40, 0);
    expect(SCAN_LIMITS.timeBudgetMs).toBe(60_000);
    expect(canStartAi(b, 59_999)).toBe(true);
    expect(canStartAi(b, 60_000)).toBe(false);
  });

  it("stops the scan once a stop reason is set", () => {
    const b = newBudget(40, 0);
    b.stop = { kind: "daily_limit", message: "Daily AI limit reached" };
    expect(canStartAi(b, 1)).toBe(false);
  });

  it("pauses on credits/access errors, stops on rate limits, and fails only the story otherwise", () => {
    expect(gatewayOutcome(402)).toBe("pause");
    expect(gatewayOutcome(403)).toBe("pause");
    expect(gatewayOutcome(429)).toBe("rate");
    expect(gatewayOutcome(503)).toBe("rate");
    expect(gatewayOutcome(400)).toBe("item");
  });
});
