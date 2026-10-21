import { describe, expect, it } from "vitest";

import { isTransientQueryError, shouldRetryQuery } from "./query-retry";

describe("query retry policy", () => {
  it("retries a generic server failure up to two times", () => {
    const err = new Error("HTTPError");
    expect(shouldRetryQuery(0, err)).toBe(true);
    expect(shouldRetryQuery(1, err)).toBe(true);
    expect(shouldRetryQuery(2, err)).toBe(false);
  });

  it("never retries permission errors", () => {
    expect(isTransientQueryError(new Error("Forbidden: super admin only"))).toBe(false);
    expect(isTransientQueryError(new Error("Unauthorized: No authorization header provided"))).toBe(false);
  });

  it("never retries not-found control flow", () => {
    expect(isTransientQueryError({ isNotFound: true })).toBe(false);
  });
});
