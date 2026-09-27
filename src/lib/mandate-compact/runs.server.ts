// Server-only run tracker for the long AI steps (Decompose, Transform).
// Each run writes a row to compact_runs and updates stage + heartbeat as it
// moves, so the page can show live progress and detect stalls after refresh.

type Sb = any;

export type RunTracker = {
  id: string | null;
  stage: (stage: string, detail?: string) => Promise<void>;
  succeed: (result: Record<string, unknown>) => Promise<void>;
  fail: (error: unknown) => Promise<void>;
};

export async function startRun(
  supabase: Sb,
  compactId: string,
  countryCode: string,
  step: "decompose" | "transform",
  userId: string,
): Promise<RunTracker> {
  // Close any older runs of the same step so only one shows as running.
  await supabase
    .from("compact_runs")
    .update({ status: "stalled", finished_at: new Date().toISOString(), error: "Superseded by a new run." })
    .eq("compact_id", compactId)
    .eq("step", step)
    .eq("status", "running");

  const { data } = await supabase
    .from("compact_runs")
    .insert({ compact_id: compactId, country_code: countryCode, step, status: "running", stage: "Starting", created_by: userId })
    .select("id")
    .single();
  const id: string | null = data?.id ?? null;

  const patch = async (p: Record<string, unknown>) => {
    if (!id) return;
    await supabase.from("compact_runs").update({ ...p, heartbeat_at: new Date().toISOString() }).eq("id", id);
  };

  return {
    id,
    stage: (stage, detail) => patch({ stage, stage_detail: detail ?? null }),
    succeed: (result) => patch({ status: "succeeded", stage: "Done", result, finished_at: new Date().toISOString() }),
    fail: (error) =>
      patch({
        status: "failed",
        error: (error instanceof Error ? error.message : String(error)).slice(0, 600),
        finished_at: new Date().toISOString(),
      }),
  };
}

/** Run `fn` with a heartbeat every 15s so long AI calls don't look stalled. */
export async function withHeartbeat<T>(run: RunTracker, stage: string, detail: string, fn: () => Promise<T>): Promise<T> {
  await run.stage(stage, detail);
  const t = setInterval(() => void run.stage(stage, detail), 15_000);
  try {
    return await fn();
  } finally {
    clearInterval(t);
  }
}
