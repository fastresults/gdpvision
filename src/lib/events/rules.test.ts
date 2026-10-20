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
