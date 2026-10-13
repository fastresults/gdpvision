import { Explain } from "@/components/explain/Explain";
import "@/lib/explain/journeys-entries";
import { cn } from "@/lib/utils";
import type { ChamberJourney } from "../chamberDecisionJourneys";
import { questionSignals, routing } from "./journeyRouting";

/** Act 4 — route through five auditable beats. */
export function ChamberRouter({ journey, beat }: { journey: ChamberJourney; beat: number }) {
  const { keywords, tags } = questionSignals(journey);
  const fits = routing(journey);
  const lead = fits.find((f) => f.role === "lead");
  if (!lead) return null;
  const support = fits.filter((f) => f.role === "support");
  const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[^\w-]/g, "")).join("|")})`, "g");

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto px-4 py-5 md:px-7">
      {/* Beat 1 — read the question */}
      <div className="cjj-beat border border-line-200 bg-paper-0 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          01 · GDPVision reads the question
        </div>
        <p className="mt-2 font-display text-lg leading-snug text-ink-950 md:text-xl">
          {journey.question.split(pattern).map((part, i) =>
            keywords.includes(part) ? (
              <mark
                key={i}
                className="cjj-mark bg-transparent text-gold-500 underline decoration-gold-500 underline-offset-4"
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span
              key={tag}
              className="cjj-beat border border-gold-500 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-950"
              style={{ animationDelay: `${0.4 + i * 0.25}s` }}
            >
              Relevant to · {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Beat 2 — weigh all ten */}
      {beat >= 1 && (
        <div className="cjj-beat">
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            <span>02 · Compare the ten workspaces</span>
            <Explain id="journeys.fit">Illustrative fit</Explain>
          </div>
          <ol className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
            {fits.map((f, i) => {
              const settled = beat >= 2;
              return (
                <li
                  key={f.index}
                  className={cn(
                    "cjj-beat flex flex-col border bg-paper-0 p-2.5 transition-all duration-700",
                    f.role === "lead" && settled
                      ? "border-gold-500 shadow-[0_0_0_2px_var(--gold-300)] md:-translate-y-1"
                      : f.role === "support"
                        ? "border-ink-700"
                        : "border-line-200",
                    settled && f.role === "other" && "opacity-45",
                  )}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] text-gold-500">{f.index}</span>
                    {settled && f.role !== "other" && (
                      <span
                        className={cn(
                          "px-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                          f.role === "lead"
                            ? "bg-ink-950 text-gold-500"
                            : "border border-ink-700 text-ink-700",
                        )}
                      >
                        {f.role === "lead" ? "Lead" : "Support"}
                      </span>
                    )}
                  </div>
                  <strong className="mt-1 text-[13px] leading-snug text-ink-950">{f.name}</strong>
                  <span className="mt-0.5 text-[12px] leading-snug text-ink-500">{f.purpose}</span>
                  <span className="mt-2 block h-1 w-full bg-line-100">
                    <span
                      className="cjj-fit block h-full bg-gold-500"
                      style={{ width: `${f.fit}%`, animationDelay: `${0.3 + i * 0.08}s` }}
                    />
                  </span>
                  <span className="mt-1.5 text-[10px] italic leading-snug text-ink-700">
                    {f.reason}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Beat 3 — route */}
      {beat >= 3 && support.length > 0 && (
        <div className="cjj-beat border border-ink-700 bg-paper-0 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">04 · Keep supporting workspaces connected</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {support.map((s) => <span key={s.index} className="border border-gold-500 px-2 py-1 text-[11px] text-ink-950"><span className="font-mono text-gold-500">{s.index}</span> · {s.name} — {s.purpose}</span>)}
          </div>
        </div>
      )}

      {beat >= 4 && (
        <div className="cjj-beat grid gap-3 border border-gold-500 bg-ink-950 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">
              05 · Workspace for this priority · illustrative route
            </div>
            <p className="mt-1 font-display text-xl text-paper-0 md:text-2xl">
              Chamber {lead.index} · {journey.method.name}
            </p>
            <p className="mt-1 text-[13px] text-paper-0 opacity-80">
              This workspace helps government answer: {lead.purpose}.
            </p>
          </div>
          {support.length > 0 && (
            <div className="shrink-0 text-paper-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold-300">
                Works alongside
              </div>
              <ul className="mt-1 space-y-1">
                {support.map((s) => (
                  <li key={s.index} className="flex items-center gap-2 text-[12px]">
                    <span className="h-px w-6 bg-gold-500" /> {s.index} · {s.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
