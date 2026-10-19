import { describe, expect, it } from "vitest";
import { keywordTags } from "./narrative-keyword-tags";

describe("keywordTags", () => {
  it("flags English political stories", () => {
    expect(keywordTags("Prime Minister calls early election").is_political).toBe(true);
  });
  it("flags English economic stories", () => {
    expect(keywordTags("IMF raises GDP growth forecast").is_economic).toBe(true);
  });
  it("flags French stories", () => {
    const r = keywordTags("Le gouvernement présente le budget et la dette");
    expect(r.is_political).toBe(true);
    expect(r.is_economic).toBe(true);
  });
  it("flags Spanish and Dutch economic stories", () => {
    expect(keywordTags("Crecimiento de la economía").is_economic).toBe(true);
    expect(keywordTags("Begroting en schuld stijgen").is_economic).toBe(true);
  });
  it("leaves unrelated stories untagged", () => {
    const r = keywordTags("Local cricket team wins the final");
    expect(r.is_political).toBe(false);
    expect(r.is_economic).toBe(false);
  });
});
