import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sectorColor } from "@/components/viz/sector-color";
import { THREAT_PRESETS } from "./threat-presets";
import { updateThreat, type FdiThreatRow, type ThreatType } from "@/lib/fdi-resilience.functions";

type Sector = { code: string; label: string; hue_token?: string | null; share_pct?: number };

export function ThreatEditorDialog({
  open,
  onOpenChange,
  threat,
  sectors,
  countryCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  threat: FdiThreatRow;
  sectors: Sector[];
  countryCode: string;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateThreat);
  const [name, setName] = useState(threat.name);
  const [type, setType] = useState<ThreatType>(threat.threat_type);
  const [targets, setTargets] = useState<string[]>(threat.target_sector_codes);
  const [severity, setSeverity] = useState(threat.severity_pct);
  const [horizon, setHorizon] = useState(threat.horizon_years);
  const [onset, setOnset] = useState(threat.onset);

  const mut = useMutation({
    mutationFn: async () =>
      updateFn({
        data: {
          id: threat.id,
          name: name.trim(),
          threatType: type,
          targetSectorCodes: targets,
          severityPct: severity,
          horizonYears: horizon,
          onset,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["studio-threats", countryCode] }),
        qc.invalidateQueries({ queryKey: ["studio-threat", threat.id] }),
      ]);
      onOpenChange(false);
    },
  });

  const canSubmit = name.trim().length > 0 && targets.length > 0 && !mut.isPending;

  function toggle(code: string) {
    setTargets((t) => (t.includes(code) ? t.filter((x) => x !== code) : [...t, code]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit threat</DialogTitle>
          <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Reshape the shock — briefing and stress-test will update on save
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto py-2">
          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-sm focus:border-ink-950 focus:outline-none"
            />
          </label>

          <div>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Threat type
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {THREAT_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setType(p.key)}
                  className={cn(
                    "border px-3 py-1.5 text-xs transition",
                    type === p.key
                      ? "border-ink-950 bg-ink-950 text-paper-0"
                      : "border-line-200 text-ink-700 hover:border-ink-950",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Target sectors
            </span>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
              {sectors.map((s, i) => {
                const on = targets.includes(s.code);
                const color = sectorColor(s.hue_token, i);
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => toggle(s.code)}
                    className={cn(
                      "flex items-center justify-between gap-2 border px-3 py-2 text-left transition",
                      on ? "border-ink-950 bg-paper-100" : "border-line-200 hover:border-ink-500",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 flex-none"
                        style={{ background: color }}
                        aria-hidden
                      />
                      <span className="truncate text-sm">{s.label}</span>
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-ink-500">
                      {(s.share_pct ?? 0).toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <NumberSlider label="Severity" suffix="%" min={0} max={100} step={5} value={severity} onChange={setSeverity} />
            <NumberSlider label="Horizon" suffix="yr" min={1} max={20} step={1} value={horizon} onChange={setHorizon} />
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Onset
              </span>
              <div className="mt-3 flex border border-line-200">
                {(["immediate", "phased", "tail_risk"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOnset(o)}
                    className={cn(
                      "flex-1 border-l border-line-200 py-2 text-xs first:border-l-0 transition",
                      onset === o ? "bg-ink-950 text-paper-0" : "hover:bg-paper-100",
                    )}
                  >
                    {o.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mut.error ? (
            <p className="text-sm text-red-600">{(mut.error as Error).message}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSubmit}
            className="bg-ink-950 text-paper-0 hover:bg-ink-950/90"
          >
            {mut.isPending ? "Saving…" : "Save threat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberSlider({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</span>
        <span className="font-serif text-xl tabular-nums text-ink-950">
          {value}
          <span className="ml-1 font-mono text-xs text-ink-500">{suffix}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-ink-950"
      />
    </div>
  );
}
