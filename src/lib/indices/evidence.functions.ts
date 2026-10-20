// @domain indices
// @tables index_evidence,index_indicators,countries
// @ui src/components/indices/admin/EvidenceTab.tsx
//
// Steward action: draft evidence with AI for one indicator across all states.
// Drafts land unverified; a person verifies each before a run counts it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertIndicesRole, type IndicesCtx } from "./access";

export const draftIndexEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        indexCode: z.enum(["CGX", "CHX", "CGV", "CCX"]),
        indicatorCode: z.string().regex(/^[a-z0-9_]{2,60}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertIndicesRole(context as unknown as IndicesCtx, "data_steward");
    const { draftIndicatorEvidence } = await import("./evidence-draft.server");
    return draftIndicatorEvidence(data.indexCode, data.indicatorCode);
  });
