import { describe, expect, test } from "vitest";

import { fetchJsonWithRetry, HttpError, isRetryable, parseRetryAfter } from "./retry";

const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function fakeFetch(seq: Array<Response | Error>) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    const next = seq.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const noSleep = () => {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
};

describe("fetchJsonWithRetry", () => {
  test("retries 5xx and network errors, waiting 2s then 8s, then succeeds", async () => {
    const f = fakeFetch([res(503), new TypeError("fetch failed"), res(200, { ok: 1 })]);
    const s = noSleep();
    const out = await fetchJsonWithRetry("u", {
      fetchImpl: f.impl,
      sleep: s.sleep,
      random: () => 0.5,
      deadline: null,
    });
    expect(out).toEqual({ json: { ok: 1 }, attempts: 3 });
    expect(s.waits).toEqual([2000, 8000]);
  });

  test("a 4xx fails at once without waiting", async () => {
    const f = fakeFetch([res(404)]);
    const s = noSleep();
    await expect(
      fetchJsonWithRetry("u", { fetchImpl: f.impl, sleep: s.sleep, deadline: null }),
    ).rejects.toThrow("HTTP 404");
    expect(f.calls).toHaveLength(1);
    expect(s.waits).toEqual([]);
  });

  test("honours Retry-After on 429", async () => {
    const f = fakeFetch([res(429, {}, { "retry-after": "5" }), res(200, [1])]);
    const s = noSleep();
    await fetchJsonWithRetry("u", {
      fetchImpl: f.impl,
      sleep: s.sleep,
      random: () => 0.5,
      deadline: null,
    });
    expect(s.waits).toEqual([5000]);
  });

  test("never waits less than Retry-After even with jitter", async () => {
    const f = fakeFetch([res(429, {}, { "retry-after": "1" }), res(200, [1])]);
    const s = noSleep();
    await fetchJsonWithRetry("u", {
      fetchImpl: f.impl,
      sleep: s.sleep,
      random: () => 0,
      deadline: null,
    });
    expect(s.waits).toEqual([1600]); // jittered 2s floor (1.6s) is above 1s
  });

  test("a passed deadline stops new requests at once", async () => {
    const f = fakeFetch([res(200, [1])]);
    await expect(
      fetchJsonWithRetry("u", { fetchImpl: f.impl, deadline: Date.now() - 1 }),
    ).rejects.toThrow("budget exhausted");
    expect(f.calls).toHaveLength(0);
  });

  test("gives up after four attempts", async () => {
    const f = fakeFetch([res(500), res(500), res(500), res(500), res(200)]);
    const s = noSleep();
    await expect(
      fetchJsonWithRetry("u", {
        fetchImpl: f.impl,
        sleep: s.sleep,
        random: () => 0.5,
        deadline: null,
      }),
    ).rejects.toThrow("HTTP 500");
    expect(f.calls).toHaveLength(4);
    expect(s.waits).toEqual([2000, 8000, 30000]);
  });

  test("does not start a wait that would pass the run deadline", async () => {
    const f = fakeFetch([res(500), res(200)]);
    const s = noSleep();
    await expect(
      fetchJsonWithRetry("u", {
        fetchImpl: f.impl,
        sleep: s.sleep,
        random: () => 0.5,
        deadline: Date.now() + 15_000, // 2s wait + 20s timeout would pass it
      }),
    ).rejects.toThrow("HTTP 500");
    expect(s.waits).toEqual([]);
  });

  test("helpers", () => {
    expect(isRetryable(new HttpError(429, null))).toBe(true);
    expect(isRetryable(new HttpError(400, null))).toBe(false);
    expect(isRetryable(new SyntaxError("bad json"))).toBe(false);
    expect(parseRetryAfter("120")).toBe(60000); // capped
    expect(parseRetryAfter(null)).toBeNull();
  });
});
