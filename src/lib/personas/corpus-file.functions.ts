// @domain personas
// @tables country_sources, country_source_documents, country_source_chunks
// @ui src/components/personas/ProgrammeSetup.tsx; src/components/personas/StudyWizard/ProgramBriefIntake.tsx; src/components/personas/StudyWizard/IntakeDocumentModal.tsx

// Chamber 07 · File Stage 00 intake material into the second brain.
//
// Every item a principal gives the chamber — the single governing Source Brief
// and any number of Supporting Context items — is registered as a country
// source, stored as a document, chunked and embedded. Roles are carried on the
// source tags (`role:brief` / `role:context`) so downstream retrieval can weigh
// the brief above its context. Idempotent: dedupe is (country, url, visibility)
// on the source and content_hash on the document, so re-filing writes nothing.
// The filing loop itself lives in corpus-file.server.ts so the brief commit
// and amendment paths share it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  role: z.enum(["brief", "context"]),
  name: z.string().min(1).max(300),
  path: z.string().max(600),
  mime: z.string().max(200),
  excerpt: z.string().max(200_000).optional(),
});

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  projectId: z.string().uuid(),
  visibility: z.enum(["public", "private"]).default("public"),
  items: z.array(ItemSchema).max(25),
});

export const fileProgrammeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorise against the country before touching the admin client.
    const { data: allowed, error: accErr } = await supabase.rpc("has_country_access", {
      _user_id: userId,
      _country_code: data.countryCode,
    });
    if (accErr) throw new Error(accErr.message);
    if (!allowed) throw new Error("No access to this country's corpus.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fileIntakeItems } = await import("./corpus-file.server");
    const res = await fileIntakeItems({
      admin: supabaseAdmin,
      countryCode: data.countryCode,
      projectId: data.projectId,
      userId,
      defaultVisibility: data.visibility,
      items: data.items,
    });

    return {
      filed: res.filed,
      chunks: res.chunks,
      skipped: res.skipped,
      ...(res.errors.length ? { errors: res.errors } : {}),
    };
  });

// ── Intake document reader ─────────────────────────────────────────────────
//
// Backs the intake viewer modal: resolves a gathered item (source brief or
// supporting context) to its filed corpus copy and returns the FULL extracted
// text — not the 8k-truncated excerpt stored on the project row — plus a
// signed link to the original file. Returns { filed: false } when the item
// hasn't reached the corpus yet so the UI can fall back to the excerpt.

const ViewInput = z.object({
  projectId: z.string().uuid(),
  path: z.string().min(1).max(2000),
});

export const getIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ViewInput.parse(d))
  .handler(async ({ data, context }) => {
    // RLS on persona_projects enforces access to this programme.
    const { data: project, error: pErr } = await context.supabase
      .from("persona_projects")
      .select("id,country_code")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("Research programme not found");
    const countryCode = (project as { country_code: string }).country_code;

    const { intakeSourceUrl } = await import("./corpus-file.server");
    const url = intakeSourceUrl({ path: data.path });
    const isLink = /^https?:\/\//i.test(url);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src } = await supabaseAdmin
      .from("country_sources")
      .select("id,title,storage_path,visibility")
      .eq("country_code", countryCode)
      .eq("url", url)
      .contains("tags", [`project:${data.projectId}`])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!src) return { filed: false as const };

    const { data: doc } = await supabaseAdmin
      .from("country_source_documents")
      .select("raw_text,char_count")
      .eq("country_source_id", (src as { id: string }).id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let downloadUrl: string | null = null;
    if (isLink) {
      downloadUrl = url;
    } else {
      const storagePath =
        (src as { storage_path?: string | null }).storage_path ?? data.path;
      const { data: signed } = await supabaseAdmin.storage
        .from("study-artifacts")
        .createSignedUrl(storagePath, 3600);
      downloadUrl = signed?.signedUrl ?? null;
    }

    return {
      filed: true as const,
      name: (src as { title?: string }).title ?? "",
      text: (doc as { raw_text?: string } | null)?.raw_text ?? "",
      chars: (doc as { char_count?: number } | null)?.char_count ?? 0,
      downloadUrl,
      visibility: (src as { visibility?: string }).visibility ?? "public",
    };
  });
