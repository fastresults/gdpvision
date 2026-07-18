import { Link } from "@tanstack/react-router";
import { Landmark, Sparkles, ChevronRight, TrendingUp, Users } from "lucide-react";
import type { RoomOverview } from "@/lib/cabinet.functions";
import { ReadinessRing, PostureBadge, Countdown } from "./primitives";

export function SituationHero({
  code, overview, posture, onSchedule,
}: {
  code: string;
  overview: RoomOverview;
  posture: Record<string, string>;
  onSchedule: () => void;
}) {
  const s = overview.nextSession;
  const readiness = overview.readiness?.pct ?? 0;
  const weekly = overview.decisionsVelocity;
  const thisWeek = weekly[weekly.length - 1]?.count ?? 0;

  return (
    <section className="relative overflow-hidden border-b border-line-200 bg-gradient-to-br from-paper-0 via-paper-0 to-[color-mix(in_oklab,var(--color-gold-500)_8%,transparent)]">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[color-mix(in_oklab,var(--color-gold-500)_12%,transparent)] blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 md:px-10 lg:grid-cols-[auto,1fr,auto]">
        <div className="flex items-center gap-5">
          <ReadinessRing value={readiness} />
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
              <Landmark size={12} strokeWidth={1.5} /> Chamber 06 · {code}
            </div>
            <h1 className="mt-1 font-serif text-3xl leading-tight md:text-4xl">{s ? s.title : "No session scheduled"}</h1>
            <div className="mt-1.5 flex items-center gap-3">
              <Countdown target={s?.scheduled_for ?? null} />
              {s && (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  {s.classification} · {s.agenda_count} items · {overview.readiness?.ready ?? 0}/{overview.readiness?.total ?? 0} ready
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2 self-center lg:justify-center">
          <PostureBadge label="Fiscal" posture={posture.fiscal ?? "—"} />
          <PostureBadge label="External" posture={posture.external ?? "—"} />
          <PostureBadge label="Social" posture={posture.social ?? "—"} />
          <PostureBadge label="Political" posture={posture.political ?? "—"} />
        </div>

        <div className="flex flex-col items-end gap-3 self-center">
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Overdue commitments</div>
            <div className="mt-0.5 font-serif text-2xl tabular-nums">{overview.overdueCount}</div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <TrendingUp size={11} /> {thisWeek} decisions · wk
            </div>
            <div className="mt-1 flex items-end justify-end gap-[2px]" style={{ height: 24 }}>
              {weekly.map((w, i) => {
                const max = Math.max(1, ...weekly.map((x) => x.count));
                return <div key={i} className="w-1 bg-ink-950/70" style={{ height: `${(w.count / max) * 100}%`, minHeight: 2 }} />;
              })}
            </div>
          </div>
          <div className="flex gap-2">
            {s ? (
              <>
                <Link to="/admin/countries/$code/cabinet/agenda/$sid" params={{ code, sid: s.id }}
                  className="inline-flex items-center gap-1 border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0">
                  Prepare <ChevronRight size={12} />
                </Link>
                <Link to="/admin/countries/$code/cabinet/session/$sid" params={{ code, sid: s.id }}
                  className="inline-flex items-center gap-1 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:opacity-90">
                  <Sparkles size={12} /> Session Mode
                </Link>
              </>
            ) : (
              <button onClick={onSchedule}
                className="inline-flex items-center gap-1 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:opacity-90">
                <Users size={12} /> Schedule session
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
