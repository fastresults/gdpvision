import { describe, expect, it } from "vitest";

import { SEXTANT_YELLOW, sextantHue, sextantTone } from "./sextant-hue";

const L = (c: string) => Number(c.match(/oklch\(([\d.]+)/)![1]);

describe("sextantHue", () => {
  it("0 is deep red", () => {
    expect(sextantTone(0)).toBe("red");
    expect(L(sextantHue(0))).toBeLessThan(L(sextantHue(40)));
  });
  it("49 is not yellow", () => {
    expect(sextantTone(49)).toBe("red");
    expect(sextantHue(49)).not.toBe(SEXTANT_YELLOW);
  });
  it("50 and 61 are yellow", () => {
    expect(sextantHue(50)).toBe(SEXTANT_YELLOW);
    expect(sextantHue(61)).toBe(SEXTANT_YELLOW);
  });
  it("62 is green", () => {
    expect(sextantTone(62)).toBe("green");
    expect(sextantHue(62)).not.toBe(SEXTANT_YELLOW);
  });
  it("100 is deep green, darker than 62", () => {
    expect(L(sextantHue(100))).toBeLessThan(L(sextantHue(62)));
  });
  it("clamps out-of-range scores", () => {
    expect(sextantHue(-10)).toBe(sextantHue(0));
    expect(sextantHue(140)).toBe(sextantHue(100));
  });
});
