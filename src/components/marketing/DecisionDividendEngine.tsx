import { useEffect, useRef, useState } from "react";

type Stage = "evidence" | "decision" | "value";

const STAGE_COPY: Record<Stage, { title: string; body: string }> = {
  evidence: {
    title: "Evidence aligned",
    body: "Public records, national records and clearly marked assumptions form one reviewable starting point.",
  },
  decision: {
    title: "Decision time reduced",
    body: "A governed route makes the choice, ownership and next action visible sooner.",
  },
  value: {
    title: "National value protected",
    body: "The estimate tests what timely execution could protect or release. It is not a forecast.",
  },
};

export function DecisionDividendEngine() {
  const ref = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState<Stage | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setStarted(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const stageProps = (stage: Stage) => ({
    tabIndex: 0,
    role: "button" as const,
    onMouseEnter: () => setActive(stage),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(stage),
    onBlur: () => setActive(null),
    onClick: () => setActive((current) => (current === stage ? null : stage)),
    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setActive((current) => (current === stage ? null : stage));
    },
  });

  const detail = active ? STAGE_COPY[active] : null;

  return (
    <figure
      ref={ref}
      className={`dde w-[330px] max-w-full select-none ${started ? "dde-on" : ""} ${active ? "dde-paused" : ""}`}
      aria-label="The Decision Dividend Engine shows evidence becoming a faster governed decision and a qualified estimate of national value."
    >
      <svg viewBox="0 0 360 276" className="block h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <pattern id="dde-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-ink-700)" strokeWidth="0.55" opacity="0.32" />
          </pattern>
          <filter id="dde-paper" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="noise" />
            <feComposite in="noise" in2="SourceGraphic" operator="in" result="texture" />
            <feBlend in="SourceGraphic" in2="texture" mode="multiply" />
          </filter>
        </defs>

        <path d="M24 139 H336" stroke="var(--color-line-200)" strokeWidth="0.8" strokeDasharray="2 5" />

        <g className="dde-evidence" {...stageProps("evidence")}>
          <path d="M22 85 H93 M30 102 H101 M18 119 H88 M34 136 H104 M24 153 H91 M38 170 H99" stroke="var(--color-ink-700)" strokeWidth="1" />
          {[34, 55, 76, 97].map((x, index) => (
            <circle key={x} className="dde-mark" cx={x} cy={93 + index * 19} r="3.5" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" style={{ ["--i" as string]: index }} />
          ))}
          <path className="dde-clock" d="M67 60 A48 48 0 0 1 110 87" fill="none" stroke="var(--color-ink-500)" strokeWidth="1" pathLength="1" />
          <path d="M67 60 V51 M110 87 L118 82" stroke="var(--color-ink-500)" strokeWidth="1" />
          <text x="61" y="199" textAnchor="middle" className="font-mono" fontSize="8" fill="var(--color-ink-700)" style={{ letterSpacing: "0.18em" }}>EVIDENCE</text>
        </g>

        <g className="dde-instrument" {...stageProps("decision")}>
          <circle cx="174" cy="127" r="61" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1.1" />
          <circle cx="174" cy="127" r="51" fill="url(#dde-hatch)" stroke="var(--color-ink-700)" strokeWidth="0.7" />
          <circle cx="174" cy="127" r="36" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.8" />
          {Array.from({ length: 16 }, (_, index) => {
            const angle = (index * Math.PI * 2) / 16;
            const x1 = 174 + Math.cos(angle) * 42;
            const y1 = 127 + Math.sin(angle) * 42;
            const x2 = 174 + Math.cos(angle) * 48;
            const y2 = 127 + Math.sin(angle) * 48;
            return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-ink-700)" strokeWidth="0.7" />;
          })}
          <g className="dde-needle" style={{ transformOrigin: "174px 127px" }}>
            <path d="M174 127 L192 96" stroke="var(--color-gold-500)" strokeWidth="2" />
            <circle cx="174" cy="127" r="4" fill="var(--color-ink-950)" />
          </g>
          <text x="174" y="144" textAnchor="middle" className="font-mono" fontSize="7.5" fill="var(--color-ink-950)" style={{ letterSpacing: "0.16em" }}>DECISION</text>
          <text x="174" y="157" textAnchor="middle" className="font-mono" fontSize="5.5" fill="var(--color-ink-500)" style={{ letterSpacing: "0.12em" }}>GOVERNED ROUTE</text>
        </g>

        <path className="dde-input" d="M101 127 C121 127 128 127 138 127" fill="none" stroke="var(--color-ink-700)" strokeWidth="1.2" pathLength="1" />
        <path className="dde-delay" d="M211 150 C239 176 264 187 294 197" fill="none" stroke="var(--color-ink-300)" strokeWidth="1" strokeDasharray="3 4" pathLength="1" />
        <text className="dde-delay-label font-mono" x="264" y="214" textAnchor="middle" fontSize="6.5" fill="var(--color-ink-500)" style={{ letterSpacing: "0.12em" }}>VALUE HELD BACK</text>

        <g className="dde-value" {...stageProps("value")}>
          <path className="dde-value-path" d="M213 116 C242 102 259 78 284 58 C301 44 316 39 337 31" fill="none" stroke="var(--color-gold-500)" strokeWidth="2" pathLength="1" />
          <path className="dde-value-wash" d="M213 116 C242 102 259 78 284 58 C301 44 316 39 337 31 L337 154 L213 154 Z" fill="var(--color-gold-300)" opacity="0.08" />
          {[238, 263, 288, 313, 337].map((x, index) => {
            const heights = [104, 84, 59, 44, 31];
            return <circle key={x} className="dde-value-node" cx={x} cy={heights[index]} r="3" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1.4" style={{ ["--i" as string]: index }} />;
          })}
          <path d="M230 154 V130 H247 V154 M255 154 V112 H272 V154 M280 154 V89 H297 V154 M305 154 V61 H322 V154" fill="url(#dde-hatch)" stroke="var(--color-ink-700)" strokeWidth="0.7" />
          <text x="282" y="177" textAnchor="middle" className="font-mono" fontSize="8" fill="var(--color-ink-950)" style={{ letterSpacing: "0.18em" }}>DECISION DIVIDEND</text>
          <text x="282" y="190" textAnchor="middle" className="font-mono" fontSize="6.4" fill="var(--color-ink-500)" style={{ letterSpacing: "0.08em" }}>UP TO 1.2% OF GDP · MODEL CEILING</text>
        </g>

        <path className="dde-floor" d="M15 224 C74 220 124 227 177 222 C232 217 282 226 344 220" fill="none" stroke="var(--color-ink-300)" strokeWidth="0.7" />
        <text x="180" y="249" textAnchor="middle" className="font-serif" fontSize="12" fill="var(--color-ink-950)">Better evidence. Faster decisions.</text>
        <text x="180" y="266" textAnchor="middle" className="font-mono" fontSize="7" fill="var(--color-ink-700)" style={{ letterSpacing: "0.16em" }}>MORE NATIONAL VALUE PROTECTED</text>
      </svg>

      <figcaption className="mx-auto min-h-[42px] max-w-[300px] text-center text-[11px] leading-relaxed text-ink-500" aria-live="polite">
        {detail ? (
          <><span className="font-mono font-semibold uppercase tracking-[0.12em] text-ink-950">{detail.title}</span><br />{detail.body}</>
        ) : (
          "Explore each stage to see how the estimate is governed."
        )}
      </figcaption>
    </figure>
  );
}