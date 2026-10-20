import { describe, expect, it } from "vitest";
import { validDraft } from "./evidence-draft";

const base = {
  country: "AG",
  value: 1,
  period: "2025",
  document_title: "FATF list",
  document_url: "https://www.fatf-gafi.org/x",
  publisher: "FATF",
  quote: "Jurisdictions under increased monitoring",
};

describe("AI evidence drafts", () => {
  it("accepts a cited, quoted value", () => expect(validDraft(base, 0, 1)).toBe(true));
  it("rejects a missing value (no guessing)", () =>
    expect(validDraft({ ...base, value: null }, 0, 1)).toBe(false));
  it("rejects a non-https source", () =>
    expect(validDraft({ ...base, document_url: "http://x.org" }, 0, 1)).toBe(false));
  it("rejects a draft without a quote", () =>
    expect(validDraft({ ...base, quote: null }, 0, 1)).toBe(false));
  it("rejects an absurd value", () => expect(validDraft({ ...base, value: 50 }, 0, 1)).toBe(false));
});
