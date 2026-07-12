// Document export system (PRD Wave F2).
// Renders HTML documents for Cabinet decisions, Briefing packs, FDI packages,
// Term reports, and State-of-the-Mandate briefings. Persists to
// exports_documents; the /admin/documents route lists and links to each.
// PDF rendering is intentionally deferred (native binaries are unavailable on
// the edge runtime); the persisted HTML is print-CSS-styled and can be
// browser-printed to PDF on demand.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DocumentKind =
  | "cabinet_decision"
  | "briefing_pack"
  | "fdi_package"
  | "term_report"
  | "state_of_mandate";

const KIND_LABELS: Record<DocumentKind, string> = {
  cabinet_decision: "Cabinet Decision",
  briefing_pack: "Briefing Pack",
  fdi_package: "FDI Package",
  term_report: "Term Report",
  state_of_mandate: "State of the Mandate",
};

function frame(title: string, subtitle: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 24mm; }
  body { font: 12pt/1.55 Georgia, serif; color: #0a0a0a; max-width: 720px; margin: 0 auto; padding: 32px; }
  header { border-bottom: 1px solid #0a0a0a; padding-bottom: 12px; margin-bottom: 24px; }
  .eyebrow { font: 10pt/1 "SF Mono", monospace; letter-spacing: 0.2em; text-transform: uppercase; color: #666; }
  h1 { font: 24pt/1.15 Georgia, serif; margin: 6px 0 0; }
  section { margin: 20px 0; }
  h2 { font: 14pt/1.2 Georgia, serif; margin-top: 24px; }
  .meta { font: 9pt/1.4 "SF Mono", monospace; color: #666; }
</style></head>
<body>
<header>
  <p class="eyebrow">GDPVision · ${escapeHtml(subtitle)}</p>
  <h1>${escapeHtml(title)}</h1>
</header>
${body}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);
}

const RenderInput = z.object({
  kind: z.enum([
    "cabinet_decision",
    "briefing_pack",
    "fdi_package",
    "term_report",
    "state_of_mandate",
  ]),
  sourceId: z.string().uuid().optional(),
  scopeKey: z.string().min(3).max(16).optional(),
});

export const renderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RenderInput.parse(d))
  .handler(async ({ data, context }) => {
    let title = KIND_LABELS[data.kind];
    let bodyHtml = `<section><p>Placeholder body for ${escapeHtml(KIND_LABELS[data.kind])}.</p></section>`;

    if (data.kind === "cabinet_decision" && data.sourceId) {
      const { data: dec } = await context.supabase
        .from("decisions")
        .select("title,body,country_code,recorded_at,mandate_id")
        .eq("id", data.sourceId)
        .maybeSingle();
      if (dec) {
        title = dec.title;
        const { data: commits } = await context.supabase
          .from("commitments")
          .select("title,status,due_at")
          .eq("decision_id", data.sourceId);
        bodyHtml = `
<section><h2>Decision</h2><p>${escapeHtml(dec.body ?? "")}</p></section>
<section><h2>Commitments</h2>
${
  (commits ?? []).length === 0
    ? "<p class=\"meta\">None recorded.</p>"
    : `<ul>${(commits ?? [])
        .map((c) => `<li><strong>${escapeHtml(c.title)}</strong> · <span class="meta">${escapeHtml(c.status ?? "open")}${c.due_at ? ` · due ${escapeHtml(new Date(c.due_at).toDateString())}` : ""}</span></li>`)
        .join("")}</ul>`
}</section>
<section class="meta">Country ${escapeHtml(dec.country_code)} · Recorded ${escapeHtml(new Date(dec.recorded_at).toDateString())}</section>`;
      }
    } else if (data.kind === "briefing_pack" && data.sourceId) {
      const { data: br } = await context.supabase
        .from("briefing_requests")
        .select("name,role,government,nation,message,created_at")
        .eq("id", data.sourceId)
        .maybeSingle();
      if (br) {
        title = `Briefing for ${br.name} · ${br.government}`;
        bodyHtml = `<section><h2>Notes</h2><p>${escapeHtml(br.message ?? "")}</p></section>
<section class="meta">${escapeHtml(br.role)} · ${escapeHtml(br.nation)} · Received ${escapeHtml(new Date(br.created_at).toDateString())}</section>`;
      }
    }


    const html = frame(title, KIND_LABELS[data.kind], bodyHtml);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("exports_documents")
      .insert({
        kind: data.kind,
        source_id: data.sourceId ?? null,
        scope_key: data.scopeKey ?? null,
        title,
        html,
        rendered_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, title };
  });

export interface DocumentRow {
  id: string;
  kind: DocumentKind;
  title: string;
  rendered_at: string;
  source_id: string | null;
}

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentRow[]> => {
    const { data, error } = await context.supabase
      .from("exports_documents")
      .select("id,kind,title,rendered_at,source_id")
      .order("rendered_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as DocumentRow[];
  });

export const getDocumentHtml = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; title: string; kind: DocumentKind; html: string }> => {
    const { data: row, error } = await context.supabase
      .from("exports_documents")
      .select("id,title,kind,html")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; title: string; kind: DocumentKind; html: string };
  });
