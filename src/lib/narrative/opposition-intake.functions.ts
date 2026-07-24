// Chamber 05 · Opposition Intel — intake + CRUD server functions.
// Files land under opposition-intel/<COUNTRY>/… (private bucket).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type OppositionKind = "meme" | "story" | "post" | "screenshot" | "link" | "text";
export type OppositionStatus = "queued" | "analyzing" | "analyzed" | "failed" | "archived";

export interface OppositionItem {
  id: string;
  country_code: string;
  kind: OppositionKind;
  title: string | null;
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  raw_text: string | null;
  submitted_channel: string | null;
  status: OppositionStatus;
  status_error: string | null;
  motivation_summary: string | null;
  origin_summary: string | null;
  amplification: Json;
  themes: Json;
  severity: number | null;
  sentiment: number | null;
  confidence_grade: string | null;
  citations: Json;
  visibility: string;
  created_at: string;
  updated_at: string;
}

export interface OppositionPlan {
  id: string;
  item_id: string;
  country_code: string;
  posture: string | null;
  objective: string | null;
  key_messages: Json;
  audience_segments: Json;
  channel_plan: Json;
  sequenced_actions: Json;
  risks: Json;
  success_metrics: Json;
  linked_artifact_ids: string[];
  citations: Json;
  confidence_grade: string | null;
  created_at: string;
  updated_at: string;
}

function safePath(country: string, filename: string) {
  const clean = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const stamp = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${country}/${stamp}-${rnd}-${clean}`;
}

// ─── list / get ───────────────────────────────────────────────────────────

export const listOppositionItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ countryCode: z.string().min(2).max(16) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<OppositionItem[]> => {
    const { data: rows, error } = await context.supabase
      .from("opposition_items")
      .select(
        "id,country_code,kind,title,source_url,storage_path,mime_type,raw_text,submitted_channel,status,status_error,motivation_summary,origin_summary,amplification,themes,severity,sentiment,confidence_grade,citations,visibility,created_at,updated_at",
      )
      .eq("country_code", data.countryCode)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as OppositionItem[];
  });

export const getOppositionItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("opposition_items")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: plan } = await context.supabase
      .from("opposition_response_plans")
      .select("*")
      .eq("item_id", data.id)
      .maybeSingle();

    let signedUrl: string | null = null;
    if (row.storage_path) {
      const { data: signed } = await context.supabase.storage
        .from("opposition-intel")
        .createSignedUrl(row.storage_path, 60 * 60);
      signedUrl = signed?.signedUrl ?? null;
    }

    return {
      item: row as unknown as OppositionItem,
      plan: (plan ?? null) as unknown as OppositionPlan | null,
      signedUrl,
    };
  });

// ─── signed upload URL ────────────────────────────────────────────────────

export const signOppositionUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      countryCode: z.string().min(2).max(16),
      filename: z.string().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const path = safePath(data.countryCode, data.filename);
    const { data: signed, error } = await context.supabase.storage
      .from("opposition-intel")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// ─── create intake row ────────────────────────────────────────────────────

const CreateInput = z.object({
  countryCode: z.string().min(2).max(16),
  kind: z.enum(["meme", "story", "post", "screenshot", "link", "text"]),
  title: z.string().max(240).optional(),
  sourceUrl: z.string().url().optional(),
  storagePath: z.string().optional(),
  mimeType: z.string().optional(),
  rawText: z.string().max(20_000).optional(),
  submittedChannel: z.string().max(60).optional(),
  submitterContext: z.string().max(8_000).optional(),
});


export const createOppositionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.sourceUrl && !data.storagePath && !data.rawText) {
      throw new Error("Provide a URL, an uploaded file, or raw text.");
    }
    const { data: row, error } = await context.supabase
      .from("opposition_items")
      .upsert(
        {
          country_code: data.countryCode,
          kind: data.kind,
          title: data.title ?? null,
          source_url: data.sourceUrl ?? null,
          storage_path: data.storagePath ?? null,
          mime_type: data.mimeType ?? null,
          raw_text: data.rawText ?? null,
          submitted_by: context.userId,
          submitted_channel: data.submittedChannel ?? null,
          status: "queued",
          owner_country_code: data.countryCode,
          uploaded_by: context.userId,
          visibility: "private",
        },
        { onConflict: "country_code,coalesce", ignoreDuplicates: false },
      )
      .select("id")
      .single();
    if (error) {
      // conflict target is functional so onConflict fallback: retry without upsert
      const { data: row2, error: e2 } = await context.supabase
        .from("opposition_items")
        .insert({
          country_code: data.countryCode,
          kind: data.kind,
          title: data.title ?? null,
          source_url: data.sourceUrl ?? null,
          storage_path: data.storagePath ?? null,
          mime_type: data.mimeType ?? null,
          raw_text: data.rawText ?? null,
          submitted_by: context.userId,
          submitted_channel: data.submittedChannel ?? null,
          status: "queued",
          owner_country_code: data.countryCode,
          uploaded_by: context.userId,
          visibility: "private",
        })
        .select("id")
        .single();
      if (e2) throw new Error(e2.message);
      return { id: row2.id };
    }
    return { id: row.id };
  });

// ─── archive ──────────────────────────────────────────────────────────────

export const archiveOppositionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("opposition_items")
      .update({ status: "archived" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
