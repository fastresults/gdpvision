import { describe, expect, it } from "vitest";
import { publicEditions, registerStatus, shapeEdition } from "./events-feed";

const base = { slug: "a", status: "published", archived: false, starts_at: "2027-01-01T00:00:00Z" };

describe("GDP Events partner feed", () => {
  it("never returns drafts or archived editions", () => {
    const rows = [base, { ...base, slug: "d", status: "draft" }, { ...base, slug: "x", archived: true }];
    expect(publicEditions(rows).map((r) => r.slug)).toEqual(["a"]);
  });
  it("upcoming only drops past editions but keeps undated ones", () => {
    const rows = [base, { ...base, slug: "past", starts_at: "2020-01-01T00:00:00Z" }, { ...base, slug: "tba", starts_at: null }];
    expect(publicEditions(rows, true, new Date("2026-10-21")).map((r) => r.slug)).toEqual(["a", "tba"]);
  });
  it("strips attendee and internal fields", () => {
    const out = shapeEdition({ ...base, id: "1", created_by: "u", event_registrations: [{ email: "x@y.z" }] }) as Record<string, unknown>;
    expect(out.event_registrations).toBeUndefined();
    expect(out.created_by).toBeUndefined();
    expect(out.id).toBeUndefined();
  });
  it("maps registration outcomes to HTTP statuses", () => {
    expect(registerStatus({ outcome: "ok" })).toBe(201);
    expect(registerStatus({ outcome: "duplicate" })).toBe(200);
    expect(registerStatus({ outcome: "closed" })).toBe(409);
    expect(registerStatus({ outcome: "not_found" })).toBe(404);
    expect(registerStatus({ outcome: "invalid" })).toBe(422);
  });
});
