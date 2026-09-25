// @domain sovereign-eye
// @tables peer_analysis_runs, country_capital_flow_partners, countries
// @ui src/components/sovereign-eye/PartnerCoverageControl.tsx
import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/lib/auth/require-admin";

export const getPartnerCoverage = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { partnerCoverage } = await import("./partner-backfill.server");
    const c = await partnerCoverage();
    return { total: c.total, covered: c.covered, missing: c.missing, stale: c.stale, status: c.run?.status ?? "idle", pauseReason: c.run?.pause_reason ?? null };
  });

/** Researches one country per call so each request stays short; the client loops. */
export const stepPartnerBackfill = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { runPartnerBackfill } = await import("./partner-backfill.server");
    const r = await runPartnerBackfill({ maxCountries: 1, force: true });
    return JSON.parse(JSON.stringify(r)) as { ok: boolean; skipped?: string; remaining?: number; processed: string[] };
  });
