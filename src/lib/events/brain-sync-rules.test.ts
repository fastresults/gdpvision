import { describe, expect, it } from "vitest";
import { brainScope, reconcile, type BrainRow, type LiveEvent } from "./brain-sync-rules";

const NOW = "2026-10-21T00:00:00Z";
const ed = (o: Partial<LiveEvent> = {}): LiveEvent => ({
  slug: "cis-2027", title: "Caribbean Investment Summit", edition_label: "CIS'27", tagline: null, summary: "Summit",
  country_code: "KNA", city: "Basseterre", venue: "Marriott", starts_at: "2027-04-20T12:00:00Z", ends_at: "2027-04-22T12:00:00Z",
  date_tba: false, registration_url: null, series_slug: "cis", series_name: "Caribbean Investment Summit", site_url: "https://cis27.com",
  sessions: [{ title: "Opening" }], speakers: [{ name: "Jane Doe", role: "Minister", organisation: "Gov" }], partners: [{ name: "CDB", tier: null, url: null }], ...o,
});
const row = (o: Partial<BrainRow>): BrainRow => ({ id: "x", scope_key: "KNA", sector_code: "finance", kind: "event", title: "t", payload: {}, visibility: "public", weight: 2, ...o });

describe("events → Second Brain sync", () => {
  it("maps two-letter country codes to the brain's three-letter scope", () => {
    expect(brainScope("AG")).toBe("ATG");
    expect(brainScope(null)).toBe("REGION");
  });

  it("adds a published edition with its speaker and partner", () => {
    const { inserts } = reconcile([], [ed()], NOW);
    expect(inserts.map((r) => r.kind).sort()).toEqual(["event", "event_partner", "event_speaker"]);
  });

  it("does not duplicate on a second run", () => {
    const first = reconcile([], [ed()], NOW).inserts.map((r, i) => ({ ...r, id: `id${i}` }));
    const second = reconcile(first, [ed()], NOW);
    expect(second.inserts).toHaveLength(0);
    expect(second.updates).toHaveLength(0);
  });

  it("hides an edition that is no longer published", () => {
    const existing = [row({ id: "e1", kind: "event", payload: { event_slug: "cis-2027" } })];
    const { updates, summary } = reconcile(existing, [], NOW);
    expect(updates[0]!.visibility).toBe("private");
    expect(summary.hidden).toBe(1);
  });

  it("hides a speaker removed by hand in Events Admin", () => {
    const existing = [row({ id: "s1", kind: "event_speaker", title: "Old Speaker — Gov", payload: { name: "Old Speaker", events: ["cis-2027"] } })];
    const { updates } = reconcile(existing, [ed()], NOW);
    expect(updates.find((u) => u.id === "s1")!.visibility).toBe("private");
  });

  it("writes hand-edited dates over scraped ones", () => {
    const existing = [row({ id: "e1", title: "Caribbean Investment Summit (CIS'27)", payload: { event_slug: "cis-2027", date_text: "April 2027", starts_on: "2027-04-01" } })];
    const { updates } = reconcile(existing, [ed()], NOW);
    expect(updates.find((u) => u.id === "e1")!.payload.starts_on).toBe("2027-04-20");
  });
});
