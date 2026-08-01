// Chamber 07 · Stage 02 · Shared, client-safe helpers for recruitment.
// Kept out of recruitment.functions.ts so that module stays a thin wrapper
// around its server-function declarations.

import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";

export type RecruitmentProjectRow = {
  id: string;
  title: string;
  country_code: string;
  brief_raw: string | null;
  brief_scope: Json | null;
  brief_source: Json | null;
  recruitment_brief: Json | null;
};

export function normEmail(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().toLowerCase();
  return t.length > 3 && t.includes("@") ? t : null;
}

export const RECRUITMENT_PROJECT_SELECT =
  "id,title,country_code,brief_raw,brief_scope,brief_source,recruitment_brief";

/** The brief as one prompt-ready block: raw text, source text, and scope. */
export function recruitmentBriefText(row: RecruitmentProjectRow): string {
  const parts: string[] = [];
  if (typeof row.brief_raw === "string") parts.push(row.brief_raw);
  const src = row.brief_source as Record<string, unknown> | null;
  if (src && typeof src["text"] === "string") parts.push(src["text"] as string);
  if (row.brief_scope) parts.push(JSON.stringify(row.brief_scope));
  return parts.join("\n\n").trim();
}

export const RecruitmentPersonaShape = z.object({
  label: z.string().trim().min(2).max(80),
  who: z.string().trim().min(4).max(600),
  why: z.string().trim().max(600).default(""),
  seniority: z.string().max(120).nullish(),
  sector: z.string().max(120).nullish(),
  region: z.string().max(120).nullish(),
  survey_target: z.number().int().min(1).max(500),
  focus_group: z.boolean(),
  where_to_look: z.array(z.string().max(200)).max(6).optional(),
});

/** Find, or create, the one panel of a kind that belongs to a programme. */
export async function ensureProgrammePanel(
  supabase: { from: (t: string) => any },
  args: { countryCode: string; projectId: string; kind: "survey" | "focus_group"; name: string },
): Promise<string> {
  const { data: existing } = await supabase
    .from("research_panels")
    .select("id")
    .eq("project_id", args.projectId)
    .eq("kind", args.kind)
    .limit(1);
  const found = existing?.[0]?.id as string | undefined;
  if (found) return found;
  const { data: created, error } = await supabase
    .from("research_panels")
    .insert({
      country_code: args.countryCode,
      project_id: args.projectId,
      kind: args.kind,
      name: args.name,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}
