import { describe, expect, it } from "vitest";
import { nextRegistrationStatus, normaliseEmail, placesLeft, registrationWindow } from "./rules";

describe("GDP Events registration rules", () => {
  it("confirms while places remain and waitlists once full", () => {
    expect(nextRegistrationStatus(40, 39)).toBe("confirmed");
    expect(nextRegistrationStatus(40, 40)).toBe("waitlist");
    expect(nextRegistrationStatus(null, 5000)).toBe("confirmed");
    expect(placesLeft(40, 45)).toBe(0);
  });

  it("closes registration after the cut-off date", () => {
    const ev = { starts_at: "2027-01-27T14:00:00Z", registration_close: "2027-01-20T23:59:00Z" };
    expect(registrationWindow(ev, new Date("2027-01-20T12:00:00Z"))).toBe("open");
    expect(registrationWindow(ev, new Date("2027-01-21T00:00:00Z"))).toBe("closed");
    expect(registrationWindow({ ...ev, registration_close: null }, new Date("2027-01-27T15:00:00Z"))).toBe("closed");
  });

  it("treats the same email in any case as one registration", () => {
    expect(normaliseEmail("  Jane@Gov.AG ")).toBe(normaliseEmail("jane@gov.ag"));
  });
});

import { sortByDate, findExistingEdition, checkInDecision } from "./rules";

describe("summit series rules", () => {
  it("sorts events with dates to be announced last", () => {
    const out = sortByDate([
      { slug: "chwis-2027", starts_at: null },
      { slug: "cbis-2027", starts_at: "2027-09-28T00:00:00Z" },
      { slug: "cgdps-2026", starts_at: "2026-11-11T00:00:00Z" },
    ]);
    expect(out.map((e) => e.slug)).toEqual(["cgdps-2026", "cbis-2027", "chwis-2027"]);
  });
  it("re-importing an edition finds the existing event instead of creating a copy", () => {
    const rows = [{ id: "a", series_slug: "cgdps", edition_label: "2026" }];
    expect(findExistingEdition(rows, "CGDPS", " 2026 ")?.id).toBe("a");
    expect(findExistingEdition(rows, "cgdps", "2027")).toBeUndefined();
  });
  it("checks a delegate in only once", () => {
    expect(checkInDecision({ status: "confirmed", checked_in_at: null })).toBe("ok");
    expect(checkInDecision({ status: "confirmed", checked_in_at: "2026-11-11T09:00:00Z" })).toBe("already");
    expect(checkInDecision({ status: "cancelled", checked_in_at: null })).toBe("cancelled");
  });
});
