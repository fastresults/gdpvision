// Onboarding seed flow (PRD Wave F3).
// When a Country Pack is activated, seed Second Brain memory templates so the
// nation immediately has a working corpus for Counsel and dossiers. Idempotent:
// existing memory objects are not duplicated.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeMemoryTitle, isUniqueViolation } from "@/lib/country-onboarding/memory-dedup";

const SEED_TEMPLATES: Array<{ scope_key: string; kind: string; title: string; body: string; weight: number }> = [
  {
    scope_key: "national",
    kind: "position",
    title: "Fiscal-responsibility posture",
    body: "The cabinet holds a fiscal-responsibility posture: primary balance targeted within the medium-term fiscal framework; net debt-to-GDP capped at the ECCB convergence band.",
    weight: 5,
  },
  {
    scope_key: "national",
    kind: "position",
    title: "Climate-resilience posture",
    body: "Investments are screened for climate resilience with a discount rate that internalises hurricane and sea-level-rise risk.",
    weight: 4,
  },
  {
    scope_key: "national",
    kind: "audience",
    title: "Cabinet audience",
    body: "Primary internal audience: Prime Minister, Cabinet Secretary, Line Ministers. Register: measured, disciplined, evidence-anchored.",
    weight: 5,
  },
  {
    scope_key: "national",
    kind: "audience",
    title: "Diaspora audience",
    body: "Secondary external audience: diaspora communities in NA/UK/EU. Register: assured, opportunity-focused, low on jargon.",
    weight: 3,
  },
  {
    scope_key: "national",
    kind: "outlet",
    title: "Public radio & national broadcaster",
    body: "Primary domestic distribution channel for cabinet statements and post-session briefings.",
    weight: 3,
  },
];

const Input = z.object({
  countryCode: z.string().min(3).max(4),
});

export const seedCountryPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // Admin-gated: only admins seed a new pack.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull sectors for the country to key memory objects.
    const { data: sectors } = await supabaseAdmin
      .from("country_sectors")
      .select("sector_code")
      .eq("country_code", data.countryCode);
    const sectorCode = sectors?.[0]?.sector_code ?? "cross_cutting";

    let inserted = 0;
    for (const tpl of SEED_TEMPLATES) {
      const { data: existing } = await supabaseAdmin
        .from("memory_objects")
        .select("id")
        .eq("scope_key", tpl.scope_key)
        .eq("sector_code", sectorCode)
        .eq("title", tpl.title)
        .maybeSingle();
      if (existing) continue;
      const { error } = await supabaseAdmin.from("memory_objects").insert({
        scope_key: tpl.scope_key,
        sector_code: sectorCode,
        kind: tpl.kind,
        title: tpl.title,
        payload: { body: tpl.body } as any,
        weight: tpl.weight,
        verified: true,
        created_by: context.userId,
      });
      if (!error) inserted += 1;
    }


    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "country_pack.seeded",
      target_type: "country",
      target_id: data.countryCode,
      metadata: { inserted } as any,
    });

    return { ok: true, inserted, skipped: SEED_TEMPLATES.length - inserted };
  });
