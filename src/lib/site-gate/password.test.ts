import { describe, expect, it } from "vitest";
import { passwordMatches } from "./password";

describe("homepage password", () => {
  it("accepts 1234", () => expect(passwordMatches("1234", "1234")).toBe(true));
  it("rejects 123", () => expect(passwordMatches("123", "1234")).toBe(false));
  it("rejects empty", () => expect(passwordMatches("", "1234")).toBe(false));
  it("rejects 12345", () => expect(passwordMatches("12345", "1234")).toBe(false));
});
