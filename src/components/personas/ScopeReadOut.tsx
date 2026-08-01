// Chamber 07 · Shared read-out of an enriched Research Scope.
//
// One renderer so Stage 00 intake (ProgramBriefIntake) and the confirmation
// screen (ProgrammeSetup) present the same material the same way — titled
// cards a principal can read, never a raw JSON dump.

import { cn } from "@/lib/utils";

export type ScopeLike = {
  title?: string;
  objectives?: string[];
  hypotheses?: string[];
  decisions?: string[];
  stakeholders?: Array<{ name?: string; type?: string; role?: string }>;
  timeframe?: string;
  geography?: string;
  sensitivities?: string[];
  success_criteria?: string[];
  open_questions?: string[];
};

export function ReadOut({
  label,
  items,
  empty,
}: {
  label: string;
  items?: Array<string | undefined | null>;
  /** Shown instead of the list when the material said nothing. */
  empty?: string;
}) {
  const clean = (items ?? []).filter((i): i is string => !!i && i.trim().length > 0);
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      {clean.length === 0 ? (
        <p className="mt-2 text-[12px] italic leading-relaxed text-ink-300">
          {empty ?? "Not stated in your material."}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {clean.slice(0, 8).map((i) => (
            <li key={i} className="text-[12.5px] leading-relaxed text-ink-700">
              <span className="mr-2 text-ink-300">—</span>
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScopeReadOut({ scope }: { scope: ScopeLike }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ReadOut label="Decisions it must inform" items={scope.decisions} />
      <ReadOut label="Objectives" items={scope.objectives} />
      <ReadOut label="Hypotheses to test" items={scope.hypotheses} />
      <ReadOut
        label="Audience & stakeholders"
        items={(scope.stakeholders ?? []).map((s) =>
          [s?.name, s?.role].filter(Boolean).join(" · "),
        )}
      />
      <ReadOut label="Geography & timeframe" items={[scope.geography, scope.timeframe]} />
      <ReadOut label="Handle carefully" items={scope.sensitivities} />
      <ReadOut label="What 'done well' looks like" items={scope.success_criteria} />
      <ReadOut
        label="The material doesn't answer"
        items={scope.open_questions}
        empty="Nothing outstanding was flagged."
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coverage — "here's where we're at" before the principal proceeds.    */
/* ------------------------------------------------------------------ */

export type CoverageState = "captured" | "thin" | "missing";

export type CoverageRowData = {
  key: string;
  title: string;
  /** Guiding question, shown only while the dimension is still open. */
  prompt: string;
  state: CoverageState;
};

function rate(count: number, strong = 2): CoverageState {
  if (count === 0) return "missing";
  return count >= strong ? "captured" : "thin";
}

export function deriveCoverage(
  scope: ScopeLike | null,
  material: { hasBrief: boolean; contextCount: number; typedChars: number },
): CoverageRowData[] {
  const s = scope ?? {};
  return [
    {
      key: "decision",
      title: "Decision",
      prompt: "What decision does this research need to inform? Who will act on it?",
      state: rate((s.decisions ?? []).length),
    },
    {
      key: "audience",
      title: "Audience",
      prompt: "Who are we listening to — segments, geographies, roles, income bands?",
      state: rate((s.stakeholders ?? []).length),
    },
    {
      key: "hypotheses",
      title: "Hypotheses",
      prompt: "What do you believe today, and what would falsify it?",
      state: rate((s.hypotheses ?? []).length),
    },
    {
      key: "timeframe",
      title: "Timeframe & scope",
      prompt: "By when do you need this? Which geographies or sectors are in scope?",
      state: rate([s.timeframe, s.geography].filter(Boolean).length),
    },
    {
      key: "sensitivities",
      title: "Sensitivities",
      prompt: "Any political, reputational or diplomatic issues to handle carefully.",
      state: rate((s.sensitivities ?? []).length, 1),
    },
    {
      key: "material",
      title: "Source material",
      prompt: "Attach the RFP, prior study, cabinet memo or clippings that seed this work.",
      state: material.hasBrief
        ? "captured"
        : material.contextCount > 0 || material.typedChars >= 40
          ? "thin"
          : "missing",
    },
  ];
}

const STATE_META: Record<CoverageState, { label: string; dot: string; text: string }> = {
  captured: { label: "Captured", dot: "bg-emerald-600", text: "text-emerald-700" },
  thin: { label: "Thin", dot: "bg-amber-500", text: "text-amber-700" },
  missing: { label: "Missing", dot: "bg-ink-300", text: "text-ink-500" },
};

export function CoverageRow({ row }: { row: CoverageRowData }) {
  const meta = STATE_META[row.state];
  return (
    <li className="border-b border-line-100 pb-2.5 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-[13px] leading-tight text-ink-950">{row.title}</p>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]",
            meta.text,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>
      {row.state !== "captured" && (
        <p className="mt-1 text-[11.5px] leading-snug text-ink-700">{row.prompt}</p>
      )}
    </li>
  );
}
