// Chamber 05 · on/off switch, AI limits and pause for the news scan (admin only).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { getPressScanControls, updatePressScanControls } from "@/lib/media-scan.functions";

export function PressScanControls() {
  const qc = useQueryClient();
  const load = useServerFn(getPressScanControls);
  const save = useServerFn(updatePressScanControls);
  const q = useQuery({ queryKey: ["admin", "press-scan-controls"], queryFn: () => load(), refetchInterval: 30_000 });
  const s = q.data?.settings;
  const [daily, setDaily] = useState("");
  const [perRun, setPerRun] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!s) return;
    setDaily(String(s.daily_ai_limit));
    setPerRun(String(s.per_run_limit));
  }, [s?.daily_ai_limit, s?.per_run_limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMutation({
    mutationFn: (d: Parameters<typeof save>[0]["data"]) => save({ data: d }),
    onSuccess: (_r, d) => {
      setMsg(
        d.autoEnabled === true
          ? "Automatic news scan switched on."
          : d.autoEnabled === false
            ? "Automatic news scan switched off. No scheduled scans will run."
            : d.clearPause
              ? "Pause cleared."
              : "Limits saved.",
      );
      void qc.invalidateQueries({ queryKey: ["admin", "press-scan-controls"] });
      void qc.invalidateQueries({ queryKey: ["admin", "media-scan"] });
    },
    onError: (e) => setMsg((e as Error).message),
  });

  if (q.isLoading) return <section className="mt-6 border border-line-200 bg-paper-0 p-4 text-sm text-ink-600">Loading scan controls…</section>;
  if (q.error || !s) return <section className="mt-6 border border-line-200 bg-paper-0 p-4 text-sm text-ink-800">Scan controls could not be loaded.</section>;

  const used = q.data?.today.calls ?? 0;
  const pct = s.daily_ai_limit > 0 ? Math.min(100, Math.round((used / s.daily_ai_limit) * 100)) : 100;
  const dailyN = Number(daily);
  const perRunN = Number(perRun);
  const limitsValid = Number.isInteger(dailyN) && dailyN >= 0 && dailyN <= 20000 && Number.isInteger(perRunN) && perRunN >= 1 && perRunN <= 500;

  return (
    <section aria-labelledby="scan-controls" className="mt-6 border border-line-200 bg-paper-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="scan-controls" className="font-display text-xl text-ink-950">Automatic news scan</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">
            {s.auto_enabled
              ? "On — scans every hour, plus 07:00 and 19:00 UTC."
              : "Off — no scheduled scans run. “Run scan now” below still works within the daily limit."}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={s.auto_enabled}
          className={s.auto_enabled ? "btn-secondary" : "btn-primary"}
          disabled={m.isPending}
          onClick={() => m.mutate({ autoEnabled: !s.auto_enabled })}
        >
          {s.auto_enabled ? "Switch off" : "Switch on"}
        </button>
      </div>

      {s.paused_reason && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-gold-500 bg-gold-300/20 p-3 text-sm text-ink-900">
          <span>
            <strong>Paused</strong> since {s.paused_at ? new Date(s.paused_at).toLocaleString() : "—"}: {s.paused_reason}. No scan will run until you clear this.
          </span>
          <button className="btn-ghost" disabled={m.isPending} onClick={() => m.mutate({ clearPause: true })}>
            Clear pause
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-500">AI requests today (UTC)</p>
          <p className="mt-1 text-lg tabular-nums text-ink-950">
            {used.toLocaleString()} of {s.daily_ai_limit.toLocaleString()}
          </p>
          <div className="mt-1 h-1.5 w-full bg-line-100" aria-hidden>
            <div className="h-full bg-ink-900" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-600">
            {(q.data?.today.skipped_offtopic ?? 0).toLocaleString()} off-topic stories skipped without AI today.
          </p>
        </div>
        <label className="text-sm text-ink-700">
          Daily AI limit
          <input
            type="number"
            min={0}
            max={20000}
            className="mt-1 block w-full border border-line-200 bg-paper-0 px-2 py-1 tabular-nums"
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
          />
          <span className="text-xs text-ink-500">Scans stop for the day once reached.</span>
        </label>
        <label className="text-sm text-ink-700">
          Stories per scan
          <input
            type="number"
            min={1}
            max={500}
            className="mt-1 block w-full border border-line-200 bg-paper-0 px-2 py-1 tabular-nums"
            value={perRun}
            onChange={(e) => setPerRun(e.target.value)}
          />
          <span className="text-xs text-ink-500">Each scan also stops starting new work after one minute.</span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="btn-secondary"
          disabled={m.isPending || !limitsValid || (dailyN === s.daily_ai_limit && perRunN === s.per_run_limit)}
          onClick={() => m.mutate({ dailyAiLimit: dailyN, perRunLimit: perRunN })}
        >
          Save limits
        </button>
        <span className="text-xs text-ink-500">Stories are sorted by a low-cost AI model ({q.data?.model}).</span>
        {msg && <p className="w-full text-sm text-ink-800">{msg}</p>}
      </div>
    </section>
  );
}
