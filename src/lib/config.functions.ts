// Country Configuration (PRD §12 Screen 0) server functions.
// Handles provisioning: registry listing, Country Pack review, activation
// (instance binding), portfolio→sector mapping confirmation, and the
// National Signature generator (Phase 0 identity artifact).

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CARICOM_OECS_REGISTRY, CANONICAL_SECTORS } from "@/lib/caricom-registry";
import { countryPack } from "@/lib/country-pack";

// ─── Registry listing ────────────────────────────────────────────────────────

export interface CountryPackRow {
  code: string;
  name: string;
  tier: string;
  cbiState: boolean;
  currency: string;
  fiscalYearStartMonth: number;
  isBound: boolean;
  isDefault: boolean;
  hasSignature: boolean;
  signatureGeneratedAt: string | null;
}

export const listCountryPacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CountryPackRow[]> => {
    const [{ data: bindings, error: bErr }, { data: countries, error: cErr }] = await Promise.all([
      context.supabase.from("instance_bindings").select("country_code,is_default").eq("user_id", context.userId),
      context.supabase.from("countries").select("code,signature_json,signature_generated_at"),
    ]);
    if (bErr) throw new Error(bErr.message);
    if (cErr) throw new Error(cErr.message);
    const bound = new Map((bindings ?? []).map((b) => [b.country_code, b.is_default]));
    const sigs = new Map((countries ?? []).map((c) => [c.code, c]));
    return CARICOM_OECS_REGISTRY.map((n) => {
      const pack = countryPack(n.code)!;
      const sig = sigs.get(n.code);
      return {
        code: n.code,
        name: n.name,
        tier: n.tier,
        cbiState: Boolean(n.cbiState),
        currency: pack.currency,
        fiscalYearStartMonth: pack.fiscalYearStartMonth,
        isBound: bound.has(n.code),
        isDefault: bound.get(n.code) === true,
        hasSignature: Boolean(sig?.signature_json),
        signatureGeneratedAt: sig?.signature_generated_at ?? null,
      };
    });
  });

// ─── Preview a single Country Pack ───────────────────────────────────────────

const PreviewInput = z.object({ code: z.string().min(3).max(4) });

export interface CountryPackPreview {
  code: string;
  name: string;
  currency: string;
  fiscalYearStartMonth: number;
  tier: string;
  cbiState: boolean;
  nso?: string;
  centralBank?: string;
  language?: string;
  portfolioMap: Array<{ sectorSlug: string; sectorLabel: string; ministry: string | null }>;
  sectorShares: Array<{ sector_code: string; label: string; share_pct: number | null; confidence_grade: string | null }>;
  ministries: Array<{ id: string; name: string; slug: string }>;
  signature: NationalSignature | null;
  signatureGeneratedAt: string | null;
}

export const previewCountryPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PreviewInput.parse(d))
  .handler(async ({ data, context }): Promise<CountryPackPreview> => {
    const pack = countryPack(data.code);
    if (!pack) throw new Error(`Unknown country ${data.code}`);

    const [{ data: sectors }, { data: ministries }, { data: country }] = await Promise.all([
      context.supabase
        .from("country_sectors")
        .select("sector_code,share_pct,confidence_grade,sectors(label)")
        .eq("country_code", data.code)
        .order("share_pct", { ascending: false }),
      context.supabase
        .from("ministries")
        .select("id,name,slug")
        .eq("country_code", data.code)
        .order("sort_order"),
      context.supabase
        .from("countries")
        .select("signature_json,signature_generated_at")
        .eq("code", data.code)
        .maybeSingle(),
    ]);

    const portfolioMap = CANONICAL_SECTORS.map((s) => ({
      sectorSlug: s.slug,
      sectorLabel: s.label,
      ministry: pack.pack.portfolioMap?.[s.slug] ?? null,
    }));

    return {
      code: pack.code,
      name: pack.name,
      currency: pack.currency,
      fiscalYearStartMonth: pack.fiscalYearStartMonth,
      tier: pack.tier,
      cbiState: Boolean(pack.cbiState),
      nso: pack.pack.nso,
      centralBank: pack.pack.centralBank,
      language: pack.pack.language,
      portfolioMap,
      sectorShares: (sectors ?? []).map((s: any) => ({
        sector_code: s.sector_code,
        label: s.sectors?.label ?? s.sector_code,
        share_pct: s.share_pct,
        confidence_grade: s.confidence_grade,
      })),
      ministries: ministries ?? [],
      signature: country?.signature_json ?? null,
      signatureGeneratedAt: country?.signature_generated_at ?? null,
    };
  });

// ─── Activate a Country Pack (bind to current user) ─────────────────────────

const ActivateInput = z.object({
  code: z.string().min(3).max(4),
  makeDefault: z.boolean().optional(),
});

export const activateCountryPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ActivateInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.makeDefault) {
      await context.supabase
        .from("instance_bindings")
        .update({ is_default: false })
        .eq("user_id", context.userId);
    }
    const { error } = await context.supabase
      .from("instance_bindings")
      .upsert(
        { user_id: context.userId, country_code: data.code, is_default: Boolean(data.makeDefault) },
        { onConflict: "user_id,country_code" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeactivateInput = z.object({ code: z.string().min(3).max(4) });

export const deactivateCountryPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeactivateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("instance_bindings")
      .delete()
      .eq("user_id", context.userId)
      .eq("country_code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── National Signature generator (Phase 0) ─────────────────────────────────

const SignatureInput = z.object({ code: z.string().min(3).max(4) });

const SignatureSchema = z.object({
  headline: z.string(),
  tagline: z.string(),
  pillars: z.array(z.object({ name: z.string(), thesis: z.string() })).min(3).max(5),
  distinctives: z.array(z.string()).min(3).max(6),
  risks: z.array(z.string()).min(2).max(5),
  palette_hint: z.string(),
});

export const generateNationalSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignatureInput.parse(d))
  .handler(async ({ data, context }) => {
    // Admin only — writes to countries (shared instance state).
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const pack = countryPack(data.code);
    if (!pack) throw new Error(`Unknown country ${data.code}`);

    const [{ data: sectors }] = await Promise.all([
      context.supabase
        .from("country_sectors")
        .select("sector_code,share_pct,sectors(label)")
        .eq("country_code", data.code)
        .order("share_pct", { ascending: false })
        .limit(6),
    ]);
    const topSectors = (sectors ?? [])
      .map((s: any) => `${s.sectors?.label ?? s.sector_code} (${s.share_pct ?? "?"}%)`)
      .join(", ");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = [
      `Produce the National Signature for ${pack.name} (${pack.code}).`,
      `Membership: ${pack.tier}${pack.cbiState ? "; CBI state" : ""}.`,
      `Currency: ${pack.currency}. Fiscal year starts month ${pack.fiscalYearStartMonth}.`,
      topSectors ? `Top sectors by share: ${topSectors}.` : "",
      "The Signature is the generative identity artifact: a distilled thesis for the nation's economic character and comms doctrine.",
      "Be specific to this country; avoid generic Caribbean tropes.",
    ]
      .filter(Boolean)
      .join(" ");

    const result = await generateText({
      model: gateway("openai/gpt-5.5"),
      prompt,
      experimental_output: Output.object({ schema: SignatureSchema }) as any,
    } as any);

    // Extract structured object. The AI SDK returns it on `experimental_output`.
    const signature = (result as any).experimental_output ?? (result as any).output ?? null;
    if (!signature) throw new Error("Signature generation returned no output");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("countries")
      .update({ signature_json: signature, signature_generated_at: new Date().toISOString() })
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    return { signature };
  });

// Local import so the module stays tree-safe: the gateway helper is
// server-only and only reached inside the handler above.
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
