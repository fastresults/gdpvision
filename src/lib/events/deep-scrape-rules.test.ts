import { describe, expect, it } from "vitest";
import { fillBlank, partnerKey, pickPages, sessionKey, speakerKey, uniqueBy } from "./deep-scrape-rules";

describe("summit deep scrape rules", () => {
  it("matches the same speaker regardless of accents and case", () => {
    expect(speakerKey("Philip J. Pierre", "Government of Saint Lucia")).toBe(speakerKey("PHILIP J PIERRE", "government of saint lucia"));
  });
  it("keeps sessions with different times separate", () => {
    expect(sessionKey("Day 1", "09:00", "Opening")).not.toBe(sessionKey("Day 1", "10:00", "Opening"));
  });
  it("dedupes partners by name", () => {
    expect(uniqueBy([{ name: "CDB" }, { name: "cdb " }], (p) => partnerKey(p.name))).toHaveLength(1);
  });
  it("never replaces a stored value and never invents one", () => {
    expect(fillBlank("AUA Antigua", "Bridgetown")).toBe("AUA Antigua");
    expect(fillBlank("", "")).toBeNull();
    expect(fillBlank(null, "Royalton Saint Lucia")).toBe("Royalton Saint Lucia");
  });
  it("reads only same-site pages and skips sign-in and legal pages", () => {
    const p = pickPages("https://x.gdpvision.com", ["https://x.gdpvision.com/agenda", "https://x.gdpvision.com/auth", "https://other.com/a", "https://x.gdpvision.com/privacy"]);
    expect(p).toEqual(["https://x.gdpvision.com", "https://x.gdpvision.com/agenda"]);
  });
});
