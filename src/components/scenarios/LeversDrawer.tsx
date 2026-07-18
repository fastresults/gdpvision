import { useEffect } from "react";
import { Lock, LockOpen, RotateCcw, X } from "lucide-react";
import type { EngineInput } from "@/lib/engine/v1_macro";
import { CANONICAL_SECTORS } from "@/lib/caricom-registry";

function titleize(slug: string) {
  return slug
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeversDrawer({
  open,
  onClose,
  defs,
  values,
  locks,
  onChange,
  onToggleLock,
  onReset,
  activeCount,
}: {
  open: boolean;
  onClose: () => void;
  defs: EngineInput["leverDefs"];
  values: Record<string, number>;
  locks: Record<string, boolean>;
  onChange: (slug: string, value: number) => void;
  onToggleLock: (slug: string) => void;
  onReset: () => void;
  activeCount: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const grouped: Record<string, typeof defs> = {};
  for (const d of defs) (grouped[d.sector_code] ??= []).push(d);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={
          "fixed inset-0 z-40 bg-ink-950/20 transition-opacity " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />
      <aside
        role="dialog"
        aria-label="Policy levers"
        className={
          "fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[440px] flex-col border-l border-line-200 bg-paper-0 shadow-xl transition-transform " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <header className="flex items-center justify-between border-b border-line-200 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
              Policy levers
            </p>
            <h3 className="mt-1 font-serif text-lg text-ink-950">
              {defs.length} levers · {activeCount} off default
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 border border-line-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:border-ink-950 hover:text-ink-950"
            >
              <RotateCcw size={11} /> Reset
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center border border-line-200 text-ink-500 hover:border-ink-950 hover:text-ink-950"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {Object.entries(grouped).map(([sectorCode, sectorDefs]) => {
              const meta = CANONICAL_SECTORS.find((c) => c.slug === sectorCode);
              return (
                <div key={sectorCode}>
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-500">
                    <span
                      className="inline-block h-3 w-1"
                      style={{
                        backgroundColor: `var(${meta?.cssVar ?? "--ink-500"})`,
                      }}
                    />
                    {meta?.label ?? sectorCode}
                  </p>
                  <div className="mt-2 space-y-4">
                    {sectorDefs.map((def) => {
                      const value =
                        values[def.slug] ?? def.bounds.default ?? def.bounds.min;
                      const dflt = def.bounds.default ?? def.bounds.min;
                      const delta = value - dflt;
                      const locked = locks[def.slug];
                      return (
                        <div
                          key={def.slug}
                          className="border-t border-line-200/60 pt-3"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <label
                              htmlFor={`lv-${def.slug}`}
                              className="min-w-0"
                            >
                              <span className="block truncate text-sm text-ink-950">
                                {titleize(def.slug)}
                              </span>
                              <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
                                {def.slug}
                              </span>
                            </label>
                            <div className="flex shrink-0 items-center gap-2">
                              {Math.abs(delta) > 0.001 && (
                                <span
                                  className="font-mono text-[10px] tabular-nums"
                                  style={{
                                    color:
                                      delta > 0
                                        ? "var(--sector-06)"
                                        : "var(--sector-04)",
                                  }}
                                >
                                  {delta > 0 ? "+" : ""}
                                  {delta.toFixed(1)}
                                </span>
                              )}
                              <span className="font-mono text-xs tabular-nums text-ink-950">
                                {value.toFixed(1)}
                              </span>
                              <button
                                onClick={() => onToggleLock(def.slug)}
                                className="text-ink-500 hover:text-ink-950"
                                aria-label={
                                  locked ? "Unlock lever" : "Lock lever"
                                }
                              >
                                {locked ? (
                                  <Lock size={11} />
                                ) : (
                                  <LockOpen size={11} />
                                )}
                              </button>
                            </div>
                          </div>
                          <input
                            id={`lv-${def.slug}`}
                            type="range"
                            min={def.bounds.min}
                            max={def.bounds.max}
                            step={0.5}
                            value={value}
                            disabled={locked}
                            onChange={(e) =>
                              onChange(def.slug, Number(e.target.value))
                            }
                            className="mt-2 w-full disabled:opacity-40"
                          />
                          <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
                            <span>{def.bounds.min}</span>
                            <span>{def.bounds.max}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
