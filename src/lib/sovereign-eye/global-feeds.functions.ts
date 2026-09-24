// @domain sovereign-eye
// @tables none
// @ui src/components/sovereign-eye/GlobeView.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
});

export const getGlobalHazards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const cc = data.countryCode.toUpperCase();
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) {
      const { data: ok } = await context.supabase.rpc("has_country_access", { _user_id: context.userId, _country_code: cc });
      if (!ok) throw new Error("Forbidden: no access to this country");
    }
    const { loadGlobalHazards } = await import("./global-feeds.server");
    return loadGlobalHazards(data.lat != null && data.lon != null ? { lat: data.lat, lon: data.lon } : null);
  });
