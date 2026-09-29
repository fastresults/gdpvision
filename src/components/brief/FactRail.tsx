// What GDPVision already knows about the chosen country: eight graded tiles,
// each with its source and, where it means something, the regional median.
// Light surfaces, hierarchy by type and rules only.

import type { CountryFacts, Fact, FactGrade } from "@/lib/calculator/facts.server";
import { cn } from "@/lib/utils";

const GRADE: Record<FactGrade, { label: string; cls: string }> = {
  A: { label: "Grade A", cls: "text-signal-positive border-signal-positive" },
  B: { label: "Grade B", cls: "text-ink-700 border-ink-700" },
  C: { label: "Grade C", cls: "text-ink-500 border-line-200" },
  assumption: { label: "Assumption", cls: "text-signal-caution border-signal-caution" },
};

export function GradeMark({ grade, className }: { grade: FactGrade; className?: string }) {
  const g = GRADE[grade];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em]",
        g.cls.split(" ")[0],
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full border bg-current",
          g.cls.split(" ")[1],
        )}
      />
      {g.label}
    </span>
  );
}

function Tile({ f }: { f: Fact }) {
  return (
    <div className="border-t border-line-200 pt-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
        {f.label}
      </div>
      <div className="mt-1.5 font-serif text-[17px] leading-snug text-ink-950">{f.display}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <GradeMark grade={f.grade} />
        {f.regional ? (
          <span className="font-mono text-[10px] text-ink-500">regional typical value {f.regional.display}</span>
        ) : null}
      </div>
      <div className="mt-1 truncate font-mono text-[9.5px] text-ink-400" title={f.source}>
        {f.source}
      </div>
    </div>
  );
}

export function FactRail({ facts, loading }: { facts: CountryFacts | null; loading: boolean }) {
  if (loading)
    return (
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse border-t border-line-200 bg-paper-50" />
        ))}
      </div>
    );
  if (!facts) return null;
  const fromRecord = facts.facts.filter((f) => f.grade !== "assumption").length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-ink-700">
          {facts.onboarded ? (
            <>
               GDPVision holds national evidence for {facts.name}: {fromRecord} of {facts.facts.length}{" "}
               figures below come from it and carry confidence grades. The rest are regional assumptions you can correct.
            </>
          ) : (
            <>
               National records for {facts.name} have not yet been added to GDPVision. The figures
               below are general regional estimates; a government engagement replaces them with the country’s own evidence.
            </>
          )}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
          {facts.region === "reference" ? "Reference set" : `${facts.region} peers`}
        </span>
      </div>
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {facts.facts.map((f) => (
          <Tile key={f.key} f={f} />
        ))}
      </div>
    </div>
  );
}
