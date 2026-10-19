// @domain indices
// @tables none
// @ui none
//
// Fetch JSON with waits between retrievals. Retries only what can recover:
// network errors, timeouts, HTTP 408/425/429 and 5xx. A 4xx (bad code, missing
// series) fails at once. Honours Retry-After (seconds or HTTP date), capped.
// Pure apart from the injected fetch and sleep, so it is unit-tested.

/** Waits before the 2nd, 3rd and 4th attempt (jittered ±20%). */
export const RETRY_WAITS_MS = [2_000, 8_000, 30_000] as const;
const RETRY_AFTER_CAP_MS = 60_000;

export class HttpError extends Error {
  constructor(
    public status: number,
    public retryAfterMs: number | null,
  ) {
    super(`HTTP ${status}`);
  }
}

export function isRetryable(e: unknown): boolean {
  if (e instanceof HttpError)
    return e.status === 408 || e.status === 425 || e.status === 429 || e.status >= 500;
  // AbortError (timeout), TypeError (network), anything else thrown by fetch itself
  return !(e instanceof SyntaxError);
}

export function parseRetryAfter(v: string | null, now = Date.now()): number | null {
  if (!v) return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.min(Math.max(0, secs * 1000), RETRY_AFTER_CAP_MS);
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.min(Math.max(0, at - now), RETRY_AFTER_CAP_MS) : null;
}

export interface RetryOpts {
  timeoutMs?: number;
  waits?: readonly number[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** absolute epoch ms after which no further retry starts (run time budget) */
  deadline?: number | null;
}

let runDeadline: number | null = null;
/** The runner sets a time budget so retries never push a run past it. */
export function setRetryDeadline(at: number | null) {
  runDeadline = at;
}

export async function fetchJsonWithRetry(
  url: string,
  opts: RetryOpts = {},
): Promise<{ json: unknown; attempts: number }> {
  const waits = opts.waits ?? RETRY_WAITS_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rnd = opts.random ?? Math.random;
  const deadline = opts.deadline === undefined ? runDeadline : opts.deadline;
  let last: unknown = null;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  for (let attempt = 1; attempt <= waits.length + 1; attempt++) {
    // the run's time budget is a hard stop: no new request once it has passed
    if (deadline != null && Date.now() >= deadline) {
      if (last instanceof Error) throw last;
      throw new Error("run time budget exhausted before this request");
    }
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await doFetch(url, {
        signal: ctl.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new HttpError(res.status, parseRetryAfter(res.headers.get("retry-after")));
      return { json: await res.json(), attempts: attempt };
    } catch (e) {
      last = e;
      if (attempt > waits.length || !isRetryable(e)) break;
      const jittered = Math.round(waits[attempt - 1] * (0.8 + 0.4 * rnd()));
      // never wait less than the server asked for
      const wait =
        e instanceof HttpError && e.retryAfterMs != null
          ? Math.max(e.retryAfterMs, jittered)
          : jittered;
      // the wait plus the next attempt's timeout must fit in the budget
      if (deadline != null && Date.now() + wait + timeoutMs > deadline) break;
      await sleep(wait);
    } finally {
      clearTimeout(t);
    }
  }
  if (last instanceof Error) throw last;
  throw new Error(String(last));
}
