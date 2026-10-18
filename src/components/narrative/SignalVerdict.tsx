// Chamber 05 · admin verdict on a signal. "Noise" lowers the source's accuracy
// in the next daily source-strength refresh; "Confirmed" protects it.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { setSignalVerdict } from "@/lib/narrative-chamber.functions";

type Verdict = "confirmed" | "noise" | null;

export function SignalVerdict({ id, initial }: { id: string; initial: Verdict }) {
  const [v, setV] = useState<Verdict>(initial);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(setSignalVerdict);
  const qc = useQueryClient();
  const choose = async (next: Verdict) => {
    const val = v === next ? null : next;
    setBusy(true);
    try {
      await save({ data: { id, verdict: val } });
      setV(val);
      void qc.invalidateQueries({ queryKey: ["narrative-signal-search"] });
    } finally {
      setBusy(false);
    }
  };
  const cls = (on: boolean) =>
    cn(
      "border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
      on ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200 text-ink-600 hover:border-ink-950",
    );
  return (
    <div className="flex items-center gap-1" title="Your verdict teaches the scan which sources to trust">
      <button type="button" disabled={busy} aria-pressed={v === "confirmed"} className={cls(v === "confirmed")} onClick={() => choose("confirmed")}>
        Confirmed
      </button>
      <button type="button" disabled={busy} aria-pressed={v === "noise"} className={cls(v === "noise")} onClick={() => choose("noise")}>
        Dismiss as noise
      </button>
    </div>
  );
}
