// @domain sector-dossier
// @tables country_sectors
// @ui src/routes/_authenticated/admin/countries.$code.onboard.tsx

// Background pre-warm of sector dossier briefs so first-open is instant.
// Iterates every sector in `country_sectors` for a country and fills the
// `sector_dossier_briefs` cache. Idempotent: skips entries whose fingerprint
// already matches (via buildSectorDossier's cache logic).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSectorDossierWithSupabase } from "./build.functions";

export type PrewarmResult = {
  countryCode: string;
  attempted: number;
  generated: number;
  cached: number;
  failed: number;
  errors: Array<{ sectorCode: string; error: string }>;
};

export const prewarmSectorDossiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      countryCode: z.string().min(2).max(4),
      force: z.boolean().optional().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PrewarmResult> => {
    const { supabase } = context;
    const { countryCode, force } = data;

    const { data: rows } = await supabase
      .from("country_sectors")
      .select("sector_code")
      .eq("country_code", countryCode);

    const sectors = Array.from(
      new Set((rows ?? []).map((r) => r.sector_code).filter(Boolean) as string[]),
    );

    const out: PrewarmResult = {
      countryCode,
      attempted: sectors.length,
      generated: 0,
      cached: 0,
      failed: 0,
      errors: [],
    };

    for (const sectorCode of sectors) {
      try {
        // Reuses the same cache path: returns cached-if-fresh, generates if missing/stale.
        const res = await buildSectorDossierWithSupabase(supabase, {
          countryCode,
          sectorCode,
          refresh: !!force,
        });
        if (res?.cached) out.cached += 1;
        else out.generated += 1;
      } catch (err) {
        out.failed += 1;
        out.errors.push({ sectorCode, error: (err as Error)?.message ?? "unknown" });
      }
      // Small delay to avoid model burst
      await new Promise((r) => setTimeout(r, 250));
    }
    return out;
  });
