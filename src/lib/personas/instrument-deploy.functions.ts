// @domain personas
// @tables field_instruments,field_collections,studies
// @ui src/components/personas/field/DeployPanel.tsx

// Chamber 07 · Instrument deployment.
//
// Three routes out of the chamber, all stamped with the instrument version so
// returns can be filed against exactly what was asked: a hosted open link, a
// printable paper form, and a machine-readable pack (CSV template + JSON) for
// whatever tool the ministry or agency already uses.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FieldQuestion } from "./instrument-draft.server";

/** Build the offline packs for an instrument, returned as inline text. */
export const buildDeployPacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ instrumentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inst, error } = await context.supabase
      .from("field_instruments")
      .select("id,study_id,kind,title,intro,outro,questions,version")
      .eq("id", data.instrumentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inst) throw new Error("Instrument not found");
    const { buildCsvTemplate, buildJsonSchema, buildPrintableForm } =
      await import("./instrument-deploy.server");
    const title = (inst.title as string | null) ?? "Instrument";
    const questions = (inst.questions ?? []) as unknown as FieldQuestion[];
    return {
      version: inst.version as number,
      csv: buildCsvTemplate(title, inst.version as number, questions),
      json: buildJsonSchema(title, inst.version as number, inst.kind as string, questions),
      form: buildPrintableForm(
        title,
        inst.version as number,
        inst.intro as string | null,
        inst.outro as string | null,
        questions,
      ),
    };
  });

/** Turn the anonymous open link on or off for a wave's collection. */
export const setOpenAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ collectionId: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: rErr } = await context.supabase
      .from("field_collections")
      .select("id,open_token,instrument_id")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!existing) throw new Error("Collection not found");

    let token = (existing.open_token as string | null) ?? null;
    if (data.enabled && !token) {
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      token = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    let version: number | null = null;
    if (existing.instrument_id) {
      const { data: inst } = await context.supabase
        .from("field_instruments")
        .select("version")
        .eq("id", existing.instrument_id as string)
        .maybeSingle();
      version = (inst?.version as number | undefined) ?? null;
    }

    const { error } = await context.supabase
      .from("field_collections")
      .update({
        open_enabled: data.enabled,
        open_token: token,
        instrument_version: version,
      } as never)
      .eq("id", data.collectionId);
    if (error) throw new Error(error.message);
    return { enabled: data.enabled, token: data.enabled ? token : null };
  });
