// One framing question: the proposed answer with its source and grade, the
// regional median beside it, and the slider to correct it. Wraps CalcSlider
// so the input primitive stays the calculator's.

import { CalcSlider } from "@/components/calculator/CalcSlider";
import type { FactGrade } from "@/lib/calculator/facts.server";
import type { FramingQuestion } from "@/lib/calculator/model";

import { GradeMark } from "./FactRail";

export function FramingCard({
  q,
  value,
  proposed,
  regional,
  onChange,
}: {
  q: FramingQuestion;
  value: number;
  proposed: { value: number; source: string; grade: FactGrade } | null;
  regional: string | null;
  onChange: (v: number) => void;
}) {
  const overridden = proposed ? Math.round(proposed.value) !== Math.round(value) : false;
  return (
    <div>
      <CalcSlider
        label={q.question}
        explainId={`calc.q.${q.key}`}
        help={q.help}
        value={value}
        min={q.min}
        max={q.max}
        step={q.step}
        unit={q.unit}
        onChange={onChange}
      />
      <div className="-mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-4 font-mono text-[10px] text-ink-500">
        {proposed ? (
          <>
            <GradeMark grade={proposed.grade} />
            <span>
              {proposed.grade === "assumption" ? "proposed from" : "from the record ·"}{" "}
              {proposed.source}
              {overridden ? ` · you set ${value}` : ""}
            </span>
          </>
        ) : (
          <>
            <GradeMark grade="assumption" />
            <span>no record — choose a country to fill this in</span>
          </>
        )}
        {regional ? <span className="ml-auto">region {regional}</span> : null}
      </div>
    </div>
  );
}
