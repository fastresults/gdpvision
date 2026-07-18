import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { createThreat } from "@/lib/fdi-resilience.functions";
import { sectorColor } from "@/components/viz/sector-color";
import { cn } from "@/lib/utils";
import { THREAT_PRESETS } from "./threat-presets";
import { ExplainHover } from "./ExplainHover";
import { EXPLAIN } from "./explain-copy";

type Sector = { code: string; label: string; hue_token?: string | null; share_pct?: number };

export function ThreatComposer({
  code,
  sectors,
}: {
  code: string;
  sectors: Sector[];
}) {
  const navigate = useNavigate();
  const createFn = useServerFn(createThreat);
  const [type, setType] = useState<(typeof THREAT_PRESETS)[number]["key"]>("tariff");
  const [name, setName] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [severity, setSeverity] = useState(50);
  const [horizon, setHorizon] = useState(5);
  const [onset, setOnset] = useState<"immediate" | "phased" | "tail_risk">("phased");

  const mut = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          countryCode: code,
          name: name.trim() || THREAT_PRESETS.find((p) => p.key === type)!.label,
          threatType: type,
          targetSectorCodes: targets,
          severityPct: severity,
          horizonYears: horizon,
          onset,
        },
      }),
    onSuccess: (res) => {
      navigate({
        to: "/admin/countries/$code/studio/threats/$id",
        params: { code, id: res.id },
      });
    },
  });

  function toggle(s: string) {
    setTargets((t) => (t.includes(s) ? t.filter((x) => x !== s) : [...t, s]));
  }

  const canSubmit = targets.length > 0 && !mut.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mut.mutate();
      }}
      className="space-y-8"
    >
      <section>
        <ExplainHover copy={EXPLAIN.pick_threat} side="right">
          <p className="cursor-help font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 underline decoration-dotted decoration-line-200 underline-offset-4">
            Step 1 · Pick a threat
          </p>
        </ExplainHover>
        <div className="mt-3 flex flex-wrap gap-2">
          {THREAT_PRESETS.map((p) => (
            <ExplainHover key={p.key} copy={{ title: p.label, what: p.hint, why: "Presets encode the transmission channel so the AI briefing and stress test use the right model of how this shock propagates.", how: "Pick the closest match; you can refine severity, horizon and onset below." }} side="top">
              <button
                type="button"
                onClick={() => setType(p.key)}
                className={cn(
                  "border px-3 py-2 text-left transition",
                  type === p.key
                    ? "border-ink-950 bg-ink-950 text-paper-0"
                    : "border-line-200 text-ink-700 hover:border-ink-950",
                )}
              >
                <span className="block text-sm">{p.label}</span>
                <span
                  className={cn(
                    "block text-[11px]",
                    type === p.key ? "text-paper-0/70" : "text-ink-500",
                  )}
                >
                  {p.hint}
                </span>
              </button>
            </ExplainHover>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Give this threat a name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${THREAT_PRESETS.find((p) => p.key === type)?.label} — 2027 scenario`}
            className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-sm focus:border-ink-950 focus:outline-none"
          />
        </label>
      </section>

      <section>
        <ExplainHover copy={EXPLAIN.target_sectors} side="right">
          <p className="cursor-help font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 underline decoration-dotted decoration-line-200 underline-offset-4">
            Step 2 · Target sectors
          </p>
        </ExplainHover>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {sectors.map((s, i) => {
            const on = targets.includes(s.code);
            const color = sectorColor(s.hue_token, i);
            return (
              <button
                type="button"
                key={s.code}
                onClick={() => toggle(s.code)}
                className={cn(
                  "flex items-center justify-between gap-2 border px-3 py-2 text-left transition",
                  on ? "border-ink-950 bg-paper-100" : "border-line-200 hover:border-ink-500",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
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
        {targets.length === 0 && (
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-500">
            <AlertTriangle size={12} /> Select at least one sector to continue.
          </p>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <ShapeControl label="Severity" suffix="%" min={0} max={100} step={5} value={severity} onChange={setSeverity} />
        <ShapeControl label="Horizon" suffix="yr" min={1} max={10} step={1} value={horizon} onChange={setHorizon} />
        <div>
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Onset</span>
          <div className="mt-3 flex gap-0 border border-line-200">
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
      </section>

      {mut.error ? (
        <p className="text-sm text-red-600">{(mut.error as Error).message}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 disabled:opacity-40"
        >
          {mut.isPending ? "Framing threat…" : "Frame the threat"}
          <ArrowRight size={14} />
        </button>
      </div>
    </form>
  );
}

function ShapeControl({
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
