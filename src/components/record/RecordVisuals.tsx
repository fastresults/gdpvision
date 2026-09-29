import { useState } from "react";
import { Archive, BrainCircuit, Landmark, LockKeyhole, RotateCcw, TrendingUp } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import type { CountryFacts, FactGrade } from "@/lib/calculator/facts.server";
import type { CorpusStats } from "@/lib/record/corpus-stats.server";
import "@/lib/explain/record-entries";

import { useCountUp, useInView } from "./useInView";

const MICRO = "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500";
const nf = (n: number) => n.toLocaleString("en-GB");

type FlywheelStage = "corpus" | "vault" | "brain" | "record" | "growth";

const FLYWHEEL_DETAIL: Record<
  FlywheelStage,
  { label: string; title: string; body: string; governance: string }
> = {
  corpus: {
    label: "01 · Gather and grade",
    title: "The Corpus",
    body: "Public statistics, budgets, reports and measures are read, cited, graded and kept current. Duplicate evidence is merged rather than counted twice.",
    governance: "Only public evidence enters this stream; every figure keeps its source and grade.",
  },
  vault: {
    label: "02 · Protect and approve",
    title: "The Sovereign Vault",
    body: "Sensitive national records remain under government control. Approved findings can inform a decision without exposing the records beneath them.",
    governance: "Named officials control what may leave the secure boundary, and every access is recorded.",
  },
  brain: {
    label: "03 · Connect and remember",
    title: "The Second Brain",
    body: "Evidence is connected across countries, ministries, sectors, programmes and past decisions so the state can find what it knows and see what is missing.",
    governance: "Relationships add context; they never remove the source, grade or access rules of the underlying evidence.",
  },
  record: {
    label: "04 · Govern once",
    title: "One National Record",
    body: "Public evidence, approved findings and institutional memory resolve into one governed view for briefings, scenarios, investments and delivery.",
    governance: "The view shows which evidence is public, restricted or approved, so unlike records are never confused.",
  },
  growth: {
    label: "05 · Act with confidence",
    title: "Conditions for durable growth",
    body: "Leaders can prepare stronger investments, improve delivery, identify risks earlier and make productivity decisions from a shared evidence base.",
    governance: "This is a pathway to better decisions—not a forecast or a promise that technology alone raises GDP.",
  },
};

function FlywheelNode({
  stage,
  active,
  onActive,
  eyebrow,
  title,
  meta,
  icon,
  delay,
}: {
  stage: FlywheelStage;
  active: FlywheelStage;
  onActive: (stage: FlywheelStage) => void;
  eyebrow: string;
  title: string;
  meta: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => onActive(stage)}
      onFocus={() => onActive(stage)}
      onClick={() => onActive(stage)}
      aria-pressed={active === stage}
      className={`record-flywheel-stage btn-ghost group relative flex min-h-[146px] w-full flex-col items-start border p-5 text-left ${
        active === stage ? "border-gold-500 bg-paper-50" : "border-line-200 bg-paper-0"
      }`}
      style={{ "--stage-delay": `${delay}ms` } as React.CSSProperties}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center border transition-colors ${
          active === stage ? "border-gold-500 text-gold-500" : "border-line-200 text-ink-700"
        }`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="mt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
        {eyebrow}
      </span>
      <span className="mt-1 font-serif text-[20px] leading-tight text-ink-950">{title}</span>
      <span className="mt-2 text-[12px] leading-relaxed text-ink-500">{meta}</span>
      <span
        className={`absolute inset-x-0 bottom-0 h-0.5 transition-colors ${active === stage ? "bg-gold-500" : "bg-transparent"}`}
        aria-hidden
      />
    </button>
  );
}

/** Explains how the three governed systems combine before any economic outcome is claimed. */
export function SovereignIntelligenceFlywheel({
  country,
  stats,
}: {
  country: string;
  stats: CorpusStats | null;
}) {
  const { ref, seen } = useInView<HTMLDivElement>(0.05);
  const [active, setActive] = useState<FlywheelStage>("brain");
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const detail = FLYWHEEL_DETAIL[active];
  const corpusMeta = stats
    ? `${nf(stats.sources)} sources · ${nf(stats.passages)} passages`
    : "Cited public evidence";

  const choose = (stage: FlywheelStage) => {
    setActive(stage);
    setPaused(true);
  };

  return (
    <div ref={ref} className="mt-12">
      <div className="flex items-center justify-between gap-5 border-b border-line-200 pb-4">
        <div className={MICRO}>Sovereign intelligence system · {country}</div>
        <button
          type="button"
          onClick={() => {
            setRun((value) => value + 1);
            setPaused(false);
            setActive("brain");
          }}
          className="btn-ghost inline-flex items-center gap-2 px-3 py-1.5 text-[10px]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Replay
        </button>
      </div>

      <div
        key={run}
        className={`record-flywheel relative py-8 ${seen ? "record-flywheel-run" : ""} ${paused ? "record-flywheel-paused" : ""}`}
        onMouseLeave={() => setPaused(false)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}
      >
        <svg
          viewBox="0 0 1000 410"
          className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
          aria-hidden
        >
          <path d="M170 112 C250 112 260 205 386 205" className="record-flywheel-line" />
          <path d="M830 112 C750 112 740 205 614 205" className="record-flywheel-line" />
          <path d="M500 112 L500 160" className="record-flywheel-line" />
          <path d="M500 250 L500 304" className="record-flywheel-line record-flywheel-line-gold" />
          <path d="M500 352 C610 352 650 326 790 326" className="record-flywheel-line record-flywheel-line-gold" />
          {[0, 1, 2].map((index) => (
            <circle
              key={`left-${index}`}
              cx="170"
              cy="112"
              r="4"
              className="record-flywheel-particle fill-gold-500"
              style={{ animationDelay: `${index * 1.1}s` }}
            />
          ))}
          {[0, 1, 2].map((index) => (
            <circle
              key={`right-${index}`}
              cx="830"
              cy="112"
              r="4"
              className="record-flywheel-particle record-flywheel-particle-reverse fill-ink-700"
              style={{ animationDelay: `${index * 1.1 + 0.5}s` }}
            />
          ))}
        </svg>

        <div className="relative grid gap-4 lg:grid-cols-3">
          <FlywheelNode
            stage="corpus"
            active={active}
            onActive={choose}
            eyebrow="Public evidence"
            title="Corpus"
            meta={corpusMeta}
            icon={<Archive className="h-4 w-4" />}
            delay={0}
          />
          <FlywheelNode
            stage="brain"
            active={active}
            onActive={choose}
            eyebrow="Connected memory"
            title="Second Brain"
            meta="Country · ministry · sector · decision"
            icon={<BrainCircuit className="h-4 w-4" />}
            delay={500}
          />
          <FlywheelNode
            stage="vault"
            active={active}
            onActive={choose}
            eyebrow="State-owned records"
            title="Sovereign Vault"
            meta="Protected in government · findings approved"
            icon={<LockKeyhole className="h-4 w-4" />}
            delay={1000}
          />
        </div>

        <div className="relative mx-auto mt-14 max-w-[520px]">
          <FlywheelNode
            stage="record"
            active={active}
            onActive={choose}
            eyebrow="Governed national memory"
            title={`One ${country} record`}
            meta="One view for briefings, scenarios, investments and delivery"
            icon={<Landmark className="h-4 w-4" />}
            delay={1700}
          />
        </div>

        <div className="relative mt-14 grid gap-5 border-t border-line-200 pt-7 lg:grid-cols-[1fr_1.35fr] lg:items-end">
          <div>
            <div className={MICRO}>Decisions strengthened</div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] text-ink-700">
              {[
                "Stronger investment cases",
                "Faster public delivery",
                "Risks found earlier",
                "Better productivity choices",
              ].map((label, index) => (
                <div
                  key={label}
                  className="record-flywheel-outcome flex items-start gap-2 border-l border-gold-500 pl-3"
                  style={{ "--stage-delay": `${2300 + index * 250}ms` } as React.CSSProperties}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onMouseEnter={() => choose("growth")}
            onFocus={() => choose("growth")}
            onClick={() => choose("growth")}
            aria-pressed={active === "growth"}
            className={`record-flywheel-growth btn-ghost relative min-h-[118px] w-full overflow-hidden border p-5 text-left ${
              active === "growth" ? "border-gold-500 bg-paper-50" : "border-line-200 bg-paper-0"
            }`}
          >
            <TrendingUp className="absolute right-5 top-5 h-5 w-5 text-gold-500" aria-hidden />
            <svg viewBox="0 0 420 70" className="absolute inset-x-0 bottom-0 w-full" aria-hidden>
              <path
                d="M0 62 C65 61 90 53 138 55 S220 42 260 44 S330 28 420 8"
                className="record-growth-path fill-none stroke-gold-500"
                strokeWidth="2"
              />
              <path
                d="M0 68 C65 67 90 59 138 61 S220 48 260 50 S330 34 420 14 L420 70 L0 70 Z"
                className="fill-paper-100 opacity-60"
              />
            </svg>
            <span className="relative font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
              Potential economic effect · not a forecast
            </span>
            <span className="relative mt-2 block max-w-sm font-serif text-[21px] leading-tight text-ink-950">
              Conditions for higher, durable GDP
            </span>
          </button>
        </div>
      </div>

      <div aria-live="polite" className="grid gap-3 border-y border-line-200 py-5 sm:grid-cols-[190px_1fr] sm:gap-8">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold-500">
            {detail.label}
          </div>
          <h3 className="mt-2 font-serif text-[22px] leading-tight text-ink-950">{detail.title}</h3>
        </div>
        <div>
          <p className="text-[14px] leading-relaxed text-ink-700">{detail.body}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{detail.governance}</p>
          {active === "growth" ? (
            <div className="mt-3 text-[12px] text-ink-500">
              <Explain id="record.growth-pathway">Why this is not a GDP forecast</Explain>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Hero constellation                                               */
/* ------------------------------------------------------------------ */

const SOURCES = [
  "Statistics office",
  "Central bank",
  "Budget",
  "IMF",
  "World Bank",
  "Ministries",
  "ECCB / CARICOM",
  "Published reports",
];

export function CorpusConstellation({
  stats,
  scopeLabel,
}: {
  stats: CorpusStats | null;
  scopeLabel: string;
}) {
  const { ref, seen } = useInView<HTMLDivElement>(0.2);
  const sources = useCountUp(stats?.sources ?? 0, seen && !!stats);
  const passages = useCountUp(stats?.passages ?? 0, seen && !!stats);
  const figures = useCountUp(stats?.figures ?? 0, seen && !!stats);
  const C = 200;
  const nodes = SOURCES.map((label, i) => {
    const a = (i / SOURCES.length) * Math.PI * 2 - Math.PI / 2;
    return { label, x: C + Math.cos(a) * 168, y: C + Math.sin(a) * 168, a };
  });
  return (
    <div ref={ref} className="w-full">
      <svg
        viewBox="-70 -6 540 412"
        className="mx-auto block w-full max-w-[480px]"
        role="img"
        aria-label="Sources flowing through a cited and graded gate into one national record"
      >
        {/* outer orbit */}
        <circle cx={C} cy={C} r={168} className="fill-none stroke-line-200" strokeDasharray="2 5" />
        {/* gate ring */}
        <g className="record-spin">
          <circle
            cx={C}
            cy={C}
            r={96}
            className="fill-none stroke-gold-500"
            strokeWidth={1}
            strokeDasharray="10 6"
          />
        </g>
        <text
          x={C}
          y={C - 104}
          textAnchor="middle"
          className="fill-gold-500 font-mono text-[8px] uppercase tracking-[0.2em]"
        >
          cited · graded
        </text>
        {/* ledger core */}
        <circle cx={C} cy={C} r={52} className="fill-paper-50 stroke-ink-950" strokeWidth={1.25} />
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={C - 26}
            x2={C + 26}
            y1={C - 12 + i * 8}
            y2={C - 12 + i * 8}
            className="stroke-ink-300"
            strokeWidth={0.8}
          />
        ))}
        <circle
          cx={C}
          cy={C}
          r={56}
          className="record-pulse fill-none stroke-gold-500"
          strokeWidth={0.8}
        />
        <text
          x={C}
          y={C + 30}
          textAnchor="middle"
          className="fill-ink-950 font-mono text-[7px] uppercase tracking-[0.2em]"
        >
          one record
        </text>
        {/* spokes + nodes */}
        {nodes.map((n, i) => (
          <g key={n.label}>
            <line x1={n.x} y1={n.y} x2={C} y2={C} className="stroke-line-200" strokeWidth={0.6} />
            <circle
              cx={n.x}
              cy={n.y}
              r={4.5}
              className="fill-paper-0 stroke-ink-700"
              strokeWidth={1}
            />
            <text
              x={n.x + Math.cos(n.a) * 10}
              y={n.y + Math.sin(n.a) * 12 + 3}
              textAnchor={
                Math.abs(Math.cos(n.a)) < 0.2 ? "middle" : Math.cos(n.a) > 0 ? "start" : "end"
              }
              className="fill-ink-500 font-mono text-[7.5px] uppercase tracking-[0.12em]"
            >
              {n.label}
            </text>
            {[0, 1].map((k) => (
              <circle
                key={k}
                cx={C}
                cy={C}
                r={2.4}
                className={`record-drift ${k === 0 ? "fill-ink-950" : "fill-gold-500"}`}
                style={
                  {
                    "--dx": `${n.x - C}px`,
                    "--dy": `${n.y - C}px`,
                    animationDelay: `${(i * 0.7 + k * 2.6).toFixed(2)}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line-200 pt-4">
        {[
          ["Public sources", sources],
          ["Passages read", passages],
          ["Figures tracked", figures],
        ].map(([label, v]) => (
          <div key={label as string}>
            <div className="font-serif text-[24px] tabular-nums leading-none text-ink-950 sm:text-[28px]">
              {stats ? nf(v as number) : "—"}
            </div>
            <div className={`mt-2 ${MICRO}`}>{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[12px] text-ink-500">
        <Explain id="record.counters">Live public totals · {scopeLabel}</Explain>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Grade ring                                                       */
/* ------------------------------------------------------------------ */

export const GRADE_ORDER: FactGrade[] = ["A", "B", "C", "assumption"];
const GRADE_CLASS: Record<FactGrade, string> = {
  A: "stroke-gold-500",
  B: "stroke-ink-950",
  C: "stroke-ink-500",
  assumption: "stroke-line-200",
};
const GRADE_DOT: Record<FactGrade, string> = {
  A: "bg-gold-500",
  B: "bg-ink-950",
  C: "bg-ink-500",
  assumption: "bg-line-200",
};
export const gradeLabel = (g: FactGrade) => (g === "assumption" ? "Assumption" : `Grade ${g}`);

export function gradeCounts(facts: CountryFacts | null) {
  const c: Record<FactGrade, number> = { A: 0, B: 0, C: 0, assumption: 0 };
  for (const f of facts?.facts ?? []) c[f.grade] += 1;
  return c;
}

export function GradeRing({
  facts,
  active,
  onActive,
}: {
  facts: CountryFacts | null;
  active: FactGrade | null;
  onActive: (g: FactGrade | null) => void;
}) {
  const counts = gradeCounts(facts);
  const total = GRADE_ORDER.reduce((s, g) => s + counts[g], 0);
  const R = 70;
  const CIRC = 2 * Math.PI * R;
  let offset = 0;
  const own = counts.A + counts.B + counts.C;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
      <svg
        viewBox="0 0 180 180"
        className="h-[180px] w-[180px] shrink-0 -rotate-90"
        role="img"
        aria-label="Share of figures at each confidence grade"
      >
        <circle cx={90} cy={90} r={R} className="fill-none stroke-paper-100" strokeWidth={16} />
        {GRADE_ORDER.map((g) => {
          const len = total ? (counts[g] / total) * CIRC : 0;
          const el = (
            <circle
              key={g}
              cx={90}
              cy={90}
              r={R}
              className={`fill-none ${GRADE_CLASS[g]} transition-all duration-700 ease-out`}
              strokeWidth={active === g ? 22 : 16}
              strokeDasharray={`${Math.max(0, len - 2)} ${CIRC}`}
              strokeDashoffset={-offset}
              opacity={active && active !== g ? 0.3 : 1}
              onMouseEnter={() => onActive(g)}
              onMouseLeave={() => onActive(null)}
            />
          );
          offset += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "90px 90px" }}>
          <text x={90} y={88} textAnchor="middle" className="fill-ink-950 font-serif text-[30px]">
            {total ? `${own}/${total}` : "—"}
          </text>
          <text
            x={90}
            y={108}
            textAnchor="middle"
            className="fill-ink-500 font-mono text-[8px] uppercase tracking-[0.18em]"
          >
            own record
          </text>
        </g>
      </svg>
      <div className="w-full">
        <div className={MICRO}>
          <Explain id="record.grade-ring">Grade mix for {facts?.name ?? "this country"}</Explain>
        </div>
        <ul className="mt-3 space-y-2">
          {GRADE_ORDER.map((g) => (
            <li
              key={g}
              onMouseEnter={() => onActive(g)}
              onMouseLeave={() => onActive(null)}
              className={`flex items-center gap-3 text-[14px] transition-opacity ${active && active !== g ? "opacity-40" : ""}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${GRADE_DOT[g]}`} aria-hidden />
              <span className="w-28 text-ink-950">{gradeLabel(g)}</span>
              <span className="h-1 flex-1 bg-paper-100">
                <span
                  className={`block h-1 ${GRADE_DOT[g]} transition-all duration-700`}
                  style={{ width: total ? `${(counts[g] / total) * 100}%` : "0%" }}
                />
              </span>
              <span className="w-8 text-right tabular-nums text-ink-700">{counts[g]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Follow one number                                                */
/* ------------------------------------------------------------------ */

const TOKENS = ["", "source tag", "Grade A", "copy merged", "3 uses", "new period"];

export function FigureJourney({
  steps,
  figure,
}: {
  steps: Array<{ head: string; body: string }>;
  figure: string;
}) {
  const { ref, seen, replay } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref}>
      <div className="flex items-center justify-between gap-4">
        <div className={MICRO}>Following one figure · {figure}</div>
        <button type="button" onClick={replay} className="btn-ghost px-3 py-1.5 text-[10px]">
          Replay
        </button>
      </div>
      {/* the path */}
      <div className="relative mt-8 hidden h-16 lg:block" aria-hidden>
        <div className="absolute left-[8%] right-[8%] top-6 h-px bg-line-200" />
        <div
          className="absolute left-[8%] top-6 h-[2px] bg-gold-500 transition-[width] ease-out"
          style={{ width: seen ? "84%" : "0%", transitionDuration: "3600ms" }}
        />
        {steps.map((s, i) => (
          <div
            key={s.head}
            className="absolute top-0 -translate-x-1/2 text-center transition-all duration-500"
            style={{
              left: `${8 + i * (84 / (steps.length - 1))}%`,
              opacity: seen ? 1 : 0.25,
              transitionDelay: `${i * 600}ms`,
            }}
          >
            <div
              className={`mx-auto mt-3 h-6 w-6 rounded-full border-2 ${seen ? "border-gold-500 bg-paper-0" : "border-line-200 bg-paper-0"}`}
            />
            {TOKENS[i] ? (
              <div className="mt-1 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-gold-500">
                {TOKENS[i]}
              </div>
            ) : (
              <div className="mt-1 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-ink-950">
                {figure}
              </div>
            )}
          </div>
        ))}
      </div>
      <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
        {steps.map((s, i) => (
          <li
            key={s.head}
            className="border-l-2 border-gold-500 pl-4 transition-all duration-500 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pt-4"
            style={{
              opacity: seen ? 1 : 0,
              transform: seen ? "none" : "translateY(10px)",
              transitionDelay: `${i * 600}ms`,
            }}
          >
            <div className={MICRO}>{String(i + 1).padStart(2, "0")}</div>
            <h3 className="mt-2 font-serif text-[20px] leading-snug text-ink-950">{s.head}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-700">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Concentric custody                                               */
/* ------------------------------------------------------------------ */

export function CustodyRings({
  active,
  onActive,
}: {
  active: number | null;
  onActive: (i: number | null) => void;
}) {
  const rings = [
    { r: 150, label: "Public evidence" },
    { r: 104, label: "Government records" },
    { r: 58, label: "State-owned data" },
  ];
  return (
    <svg
      viewBox="0 0 320 320"
      className="mx-auto block w-full max-w-[340px]"
      role="img"
      aria-label="Three nested rings of evidence with state-owned data at the core"
    >
      {rings.map((ring, i) => (
        <g
          key={ring.label}
          onMouseEnter={() => onActive(i)}
          onMouseLeave={() => onActive(null)}
          className="cursor-default"
        >
          <circle
            cx={160}
            cy={160}
            r={ring.r}
            className={`transition-all duration-300 ${i === 2 ? "fill-paper-100" : "fill-paper-0"} ${active === i ? "stroke-gold-500" : "stroke-ink-700"}`}
            strokeWidth={active === i ? 2 : 1}
            strokeDasharray={i === 0 ? "3 4" : undefined}
          />
          <text
            x={160}
            y={160 - ring.r + 14}
            textAnchor="middle"
            className={`font-mono text-[8px] uppercase tracking-[0.16em] ${active === i ? "fill-gold-500" : "fill-ink-500"}`}
          >
            {ring.label}
          </text>
        </g>
      ))}
      {/* vault lock */}
      <rect x={148} y={160} width={24} height={18} rx={2} className="fill-ink-950" />
      <path
        d="M152 160 v-6 a8 8 0 0 1 16 0 v6"
        className="fill-none stroke-ink-950"
        strokeWidth={2.5}
      />
      {/* approved findings rising out */}
      <line
        x1={160}
        y1={140}
        x2={160}
        y2={10}
        className="stroke-gold-500"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <rect
        x={146}
        y={96}
        width={28}
        height={10}
        className="fill-paper-0 stroke-gold-500"
        strokeWidth={1}
      />
      <text
        x={180}
        y={104}
        className="fill-gold-500 font-mono text-[7px] uppercase tracking-[0.14em]"
      >
        approved by named officials
      </text>
      {[0, 1, 2].map((k) => (
        <circle key={k} cx={160} cy={140} r={2.5} className="fill-gold-500">
          <animate
            attributeName="cy"
            from="140"
            to="12"
            dur="4.5s"
            begin={`${k * 1.5}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="4.5s"
            begin={`${k * 1.5}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Before / after bars                                              */
/* ------------------------------------------------------------------ */

export function BeforeAfter({
  index,
  children,
}: {
  index: number;
  children: (seen: boolean, delay: number) => React.ReactNode;
}) {
  const { ref, seen } = useInView<HTMLDivElement>(0.4);
  return <div ref={ref}>{children(seen, index * 150)}</div>;
}

export function EffortBars({ seen, delay }: { seen: boolean; delay: number }) {
  return (
    <div className="mt-3 space-y-1.5" aria-hidden>
      <div className="h-1.5 bg-paper-100">
        <div
          className="h-1.5 bg-ink-300 transition-[width] duration-1000 ease-out"
          style={{ width: seen ? "92%" : "0%", transitionDelay: `${delay}ms` }}
        />
      </div>
      <div className="h-1.5 bg-paper-100">
        <div
          className="h-1.5 bg-gold-500 transition-[width] duration-1000 ease-out"
          style={{ width: seen ? "18%" : "0%", transitionDelay: `${delay + 400}ms` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Trust scale                                                      */
/* ------------------------------------------------------------------ */

export function TrustScale({ facts }: { facts: CountryFacts | null }) {
  const { ref, seen } = useInView<HTMLDivElement>(0.3);
  const counts = gradeCounts(facts);
  const scale: FactGrade[] = ["assumption", "C", "B", "A"];
  const max = Math.max(1, ...scale.map((g) => counts[g]));
  return (
    <div ref={ref}>
      <div className="flex items-end gap-2 sm:gap-4">
        {scale.map((g, i) => (
          <div key={g} className="flex flex-1 flex-col items-center">
            <div className="flex h-24 w-full items-end justify-center">
              <div
                className={`w-full max-w-[64px] ${GRADE_DOT[g]} transition-[height] duration-700 ease-out`}
                style={{
                  height: seen ? `${Math.max(4, (counts[g] / max) * 100)}%` : "0%",
                  transitionDelay: `${i * 150}ms`,
                }}
              />
            </div>
            <div className="mt-2 font-mono text-[11px] tabular-nums text-ink-950">{counts[g]}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-3 h-2 bg-gradient-to-r from-line-200 via-ink-500 to-gold-500" />
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
        <span>Least trust</span>
        <span>{facts ? `${facts.name} · headline figures` : ""}</span>
        <span>Most trust</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Corpus pulse                                                     */
/* ------------------------------------------------------------------ */

export function CorpusPulse({ stats }: { stats: CorpusStats | null }) {
  const items = stats?.pulse ?? [];
  const [paused, setPaused] = useState(false);
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <section
      className="border-b border-line-200 bg-paper-50"
      aria-label="Recently refreshed public figures"
    >
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-5 py-4 sm:px-6 md:px-10">
        <div className="flex shrink-0 items-center gap-2">
          <span className="record-pulse h-2 w-2 rounded-full bg-gold-500" aria-hidden />
          <span className={MICRO}>Kept current</span>
        </div>
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <ul
            className="record-ticker flex w-max gap-10"
            style={paused ? { animationPlayState: "paused" } : undefined}
          >
            {row.map((p, i) => (
              <li
                key={i}
                className="whitespace-nowrap text-[13px] text-ink-700"
                aria-hidden={i >= items.length}
              >
                <span className="font-mono text-[11px] text-ink-500">{p.country}</span> · {p.label}
                {p.period ? ` · ${p.period}` : ""} ·{" "}
                <span className={p.grade === "A" ? "text-gold-500" : "text-ink-950"}>
                  {gradeLabel(p.grade)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
