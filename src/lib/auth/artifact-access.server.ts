// Confirms the caller can see an artifact through their own RLS-scoped client
// before privileged writes that reference it.
const TABLE = {
  strategy: "strategy_statements",
  comms: "comms_artifacts",
  counsel: "counsel_answers",
} as const;

export async function assertArtifactAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  type: keyof typeof TABLE,
  id: string,
): Promise<void> {
  const { data, error } = await supabase.from(TABLE[type]).select("id").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Forbidden: no access to this artifact");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertSignalAccess(supabase: any, id: string): Promise<void> {
  const { data, error } = await supabase.from("intake_items").select("id").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Forbidden: no access to this signal");
}
