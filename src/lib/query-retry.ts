// Retry policy for TanStack Query. Brief server hiccups (dev-server cold
// start, a worker restart, a dropped connection) resolve on a second try;
// permission, validation and not-found errors never will, so they fail fast.

export const MAX_QUERY_RETRIES = 2;

const PERMANENT = /unauthori[sz]ed|forbidden|not found|invalid|required|expected/i;

export function isTransientQueryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;
  const e = error as { isNotFound?: boolean; status?: number; statusCode?: number; message?: unknown };
  // TanStack router control-flow objects (notFound / redirect) are not failures.
  if (e.isNotFound || error instanceof Response) return false;
  const status = e.status ?? e.statusCode;
  if (typeof status === "number" && status >= 300 && status < 500) return false;
  const message = typeof e.message === "string" ? e.message : "";
  return !PERMANENT.test(message);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isTransientQueryError(error);
}

export function queryRetryDelay(attempt: number): number {
  return Math.min(400 * 2 ** attempt, 2000);
}
