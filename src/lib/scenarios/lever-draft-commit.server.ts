type LeverProposal = {
  slug: string;
  name: string;
  sector_code: string;
  unit: string;
  response_fn_ref: string;
  bounds: { min: number; max: number; default: number };
  rationale: string;
  citations: Array<{ label: string; kind: string; ref?: string }>;
};

type SupabaseLike = {
  from: (table: string) => any;
};

export async function commitLeverRows({
  supabase,
  draftId,
  selectedSlugs,
  edits,
}: {
  supabase: SupabaseLike;
  draftId: string;
  selectedSlugs: string[];
  edits?: Record<string, { name?: string; min?: number; max?: number; default?: number }>;
}): Promise<{ inserted: number }> {
  const { data: draft, error: dErr } = await supabase
    .from("lever_drafts")
    .select("id,country_code,payload,status")
    .eq("id", draftId)
    .maybeSingle();
  if (dErr || !draft) throw new Error(dErr?.message ?? "Draft not found");
  if (draft.status === "committed") throw new Error("Draft already committed");

  const payload = draft.payload as { proposals?: LeverProposal[] };
  const proposals = Array.isArray(payload?.proposals) ? payload.proposals : [];
  const bySlug = new Map(proposals.map((p) => [p.slug, p]));
  const rows: Array<Record<string, unknown>> = [];
  const safeEdits = edits ?? {};

  for (const slug of selectedSlugs) {
    const p = bySlug.get(slug);
    if (!p) continue;
    const edit = safeEdits[slug] ?? {};
    const min = edit.min ?? p.bounds.min;
    const max = edit.max ?? p.bounds.max;
    const dflt = Math.min(max, Math.max(min, edit.default ?? p.bounds.default));
    rows.push({
      country_code: draft.country_code,
      sector_code: p.sector_code,
      slug: p.slug,
      name: edit.name ?? p.name,
      unit: p.unit,
      response_fn_ref: p.response_fn_ref,
      methodology_ref: `ai_synth:${draft.id}`,
      bounds: { min, max, default: dflt },
      rationale: p.rationale,
      citations: p.citations,
      draft_id: draft.id,
    });
  }

  if (rows.length === 0) return { inserted: 0 };

  const { error: upErr } = await supabase
    .from("levers")
    .upsert(rows, { onConflict: "country_code,slug" });
  if (upErr) throw new Error(upErr.message);

  await supabase
    .from("lever_drafts")
    .update({ status: "committed", committed_at: new Date().toISOString() })
    .eq("id", draft.id);

  return { inserted: rows.length };
}