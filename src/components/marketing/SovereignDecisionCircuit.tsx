import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Stage = "corpus" | "vault" | "analysis" | "approval" | "value";

const STAGE_COPY: Record<Stage, { title: string; body: string }> = {
  corpus: {
    title: "Public Corpus",
    body: "Cited public evidence comes into the government-controlled system to meet the national record.",
  },
  vault: {
    title: "Owned and managed by the state",
    body: "The hardware and private national data remain on government premises, under government control.",
  },
  analysis: {
    title: "Governed analysis",
    body: "Public evidence and protected records are analysed together inside the sovereign boundary.",
  },
  approval: {
    title: "Approved findings only",
    body: "Private records do not leave. Only checked findings approved by named officials may cross the boundary.",
  },
  value: {
    title: "Better decisions, made sooner",
    body: "Stronger evidence can improve investment, delivery, resilience and productivity—the conditions for durable GDP growth.",
  },
};

export function SovereignDecisionCircuit() {
  const ref = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState<Stage | null>(null);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setStarted(true);
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setCycle((current) => current + 1), 10_500);
    return () => window.clearTimeout(timer);
  }, [started, active, cycle]);

  const stageProps = (stage: Stage) => ({
    tabIndex: 0,
    role: "button" as const,
    "aria-label": `${STAGE_COPY[stage].title}. ${STAGE_COPY[stage].body}`,
    onMouseEnter: () => setActive(stage),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(stage),
    onBlur: () => setActive(null),
    onClick: () => setActive((current) => (current === stage ? null : stage)),
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setActive((current) => (current === stage ? null : stage));
    },
  });

  const detail = active ? STAGE_COPY[active] : null;

  return (
    <figure
      ref={ref}
      className={`sdc w-full max-w-[520px] select-none ${started ? "sdc-on" : ""} ${active ? "sdc-paused" : ""}`}
      aria-label="The Sovereign Decision Circuit shows public evidence entering state-owned servers, protected national data remaining inside, and approved findings supporting timely decisions and durable GDP growth."
    >
      <svg key={cycle} viewBox="0 0 520 410" className="block h-auto w-full overflow-visible">
        <title>Public and protected evidence become approved findings inside a state-owned sovereign system</title>
        <defs>
          <pattern id="sdc-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-ink-700)" strokeWidth="0.55" opacity="0.34" />
          </pattern>
          <pattern id="sdc-hatch-dense" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-42)">
            <line x1="0" y1="0" x2="0" y2="3.5" stroke="var(--color-ink-950)" strokeWidth="0.5" opacity="0.26" />
          </pattern>
        </defs>

        {/* Public evidence approaches the sovereign boundary. */}
        <g className="sdc-corpus" {...stageProps("corpus")}>
          <text x="52" y="65" className="font-mono" fontSize="8" fill="var(--color-ink-500)" style={{ letterSpacing: "0.16em" }}>PUBLIC CORPUS</text>
          {[0, 1, 2, 3].map((index) => (
            <g key={index} className="sdc-paper" style={{ ["--i" as string]: index }}>
              <rect x={34 + index * 13} y={89 + index * 34} width="38" height="27" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.8" />
              <path d={`M${40 + index * 13} ${98 + index * 34} h25 M${40 + index * 13} ${104 + index * 34} h19`} stroke="var(--color-ink-500)" strokeWidth="0.65" />
            </g>
          ))}
          <path className="sdc-public-path" d="M78 147 C121 147 127 177 166 177" fill="none" stroke="var(--color-ink-700)" strokeWidth="1.2" pathLength="1" />
          {[0, 1, 2].map((index) => (
            <circle key={index} className="sdc-public-particle" cx="78" cy="147" r="2.5" fill="var(--color-ink-700)" style={{ ["--i" as string]: index }} />
          ))}
        </g>

        {/* State boundary and state-owned server cluster. */}
        <g className="sdc-vault" {...stageProps("vault")}>
          <rect x="158" y="48" width="236" height="246" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1.2" strokeDasharray="4 4" />
          <rect x="174" y="34" width="204" height="27" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1" />
          <text x="276" y="51" textAnchor="middle" className="font-mono" fontSize="8" fill="var(--color-ink-950)" style={{ letterSpacing: "0.13em" }}>OWNED + MANAGED BY THE STATE</text>

          {[0, 1, 2].map((index) => {
            const x = 182 + index * 67;
            return (
              <g key={index} className="sdc-server" style={{ ["--i" as string]: index }}>
                <rect x={x} y="92" width="56" height="122" rx="2" fill="url(#sdc-hatch)" stroke="var(--color-ink-950)" strokeWidth="1" />
                <rect x={x + 7} y="102" width="42" height="25" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.8" />
                <path d={`M${x + 8} 142 h40 M${x + 8} 154 h40 M${x + 8} 166 h40 M${x + 8} 178 h40`} stroke="var(--color-ink-700)" strokeWidth="0.7" />
                {[0, 1, 2].map((light) => (
                  <circle key={light} className="sdc-server-light" cx={x + 13 + light * 12} cy="198" r="2" fill="var(--color-ink-700)" style={{ ["--i" as string]: index + light }} />
                ))}
              </g>
            );
          })}
          <text x="276" y="231" textAnchor="middle" className="font-mono" fontSize="7" fill="var(--color-ink-700)" style={{ letterSpacing: "0.14em" }}>SOVEREIGN SERVERS · GOVERNMENT PREMISES</text>
          <g className="sdc-private">
            <path d="M197 255 h158" stroke="var(--color-line-200)" strokeWidth="0.8" />
            {[205, 230, 255, 280, 305].map((x, index) => (
              <rect key={x} x={x} y={261 + (index % 2) * 7} width="16" height="10" fill="url(#sdc-hatch-dense)" stroke="var(--color-ink-700)" strokeWidth="0.6" />
            ))}
            <text x="276" y="286" textAnchor="middle" className="font-mono" fontSize="6.5" fill="var(--color-ink-500)" style={{ letterSpacing: "0.12em" }}>PRIVATE NATIONAL DATA STAYS INSIDE</text>
          </g>
        </g>

        {/* Analysis dial exists only within the state boundary. */}
        <g className="sdc-analysis" {...stageProps("analysis")}>
          <circle cx="276" cy="155" r="42" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1.1" />
          <circle cx="276" cy="155" r="33" fill="url(#sdc-hatch-dense)" stroke="var(--color-ink-700)" strokeWidth="0.7" />
          {Array.from({ length: 12 }, (_, index) => {
            const angle = (index * Math.PI * 2) / 12;
            return <line key={index} x1={276 + Math.cos(angle) * 34} y1={155 + Math.sin(angle) * 34} x2={276 + Math.cos(angle) * 39} y2={155 + Math.sin(angle) * 39} stroke="var(--color-ink-700)" strokeWidth="0.7" />;
          })}
          <g className="sdc-needle" style={{ transformOrigin: "276px 155px" }}>
            <path d="M276 155 L293 133" stroke="var(--color-gold-500)" strokeWidth="1.8" />
            <circle cx="276" cy="155" r="3.5" fill="var(--color-ink-950)" />
          </g>
          <text x="276" y="174" textAnchor="middle" className="font-mono" fontSize="6.2" fill="var(--color-ink-950)" style={{ letterSpacing: "0.1em" }}>GOVERNED ANALYSIS</text>
        </g>

        {/* Two approvals unlock one finding; no private record crosses the boundary. */}
        <g className="sdc-approval" {...stageProps("approval")}>
          <path className="sdc-approved-path" d="M394 176 C423 176 431 154 452 154" fill="none" stroke="var(--color-gold-500)" strokeWidth="1.5" pathLength="1" />
          {[0, 1].map((index) => (
            <g key={index} className="sdc-approval-mark" style={{ ["--i" as string]: index }} transform={`translate(${407 + index * 18} ${196 + index * 9})`}>
              <circle r="7" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1" />
              <path d="M-3 0 l2.5 3 5 -6" fill="none" stroke="var(--color-gold-500)" strokeWidth="1.2" />
            </g>
          ))}
          <rect className="sdc-finding" x="447" y="137" width="44" height="34" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1" />
          <path d="M454 146 h29 M454 153 h23 M454 160 h26" stroke="var(--color-gold-500)" strokeWidth="0.65" />
          <text x="455" y="186" textAnchor="middle" className="font-mono" fontSize="6.5" fill="var(--color-ink-500)" style={{ letterSpacing: "0.1em" }}>APPROVED FINDING</text>
        </g>

        {/* Decision register and qualified growth pathway. */}
        <g className="sdc-value" {...stageProps("value")}>
          <path className="sdc-decision-path" d="M455 171 V256 C455 275 432 285 403 294" fill="none" stroke="var(--color-gold-500)" strokeWidth="1.3" pathLength="1" />
          <rect x="300" y="283" width="112" height="45" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1" />
          <text x="356" y="301" textAnchor="middle" className="font-mono" fontSize="7" fill="var(--color-ink-950)" style={{ letterSpacing: "0.12em" }}>TIMELY DECISION</text>
          <text x="356" y="315" textAnchor="middle" className="font-serif" fontSize="9" fill="var(--color-ink-700)">Better informed. Governed.</text>
          <path className="sdc-growth-path" d="M302 362 C342 358 367 348 397 350 C429 352 453 326 490 306" fill="none" stroke="var(--color-gold-500)" strokeWidth="2" pathLength="1" />
          {[320, 362, 404, 447, 489].map((x, index) => {
            const y = [358, 351, 348, 332, 306][index];
            return <circle key={x} className="sdc-growth-node" cx={x} cy={y} r="3" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1.2" style={{ ["--i" as string]: index }} />;
          })}
          <text x="395" y="383" textAnchor="middle" className="font-mono" fontSize="7" fill="var(--color-ink-950)" style={{ letterSpacing: "0.14em" }}>CONDITIONS FOR HIGHER GDP</text>
          <text x="395" y="396" textAnchor="middle" className="font-mono" fontSize="5.7" fill="var(--color-ink-500)" style={{ letterSpacing: "0.08em" }}>QUALIFIED PATHWAY · NOT A FORECAST</text>
        </g>

        <path d="M22 350 C94 344 156 354 232 348" fill="none" stroke="var(--color-ink-300)" strokeWidth="0.7" />
        <text x="126" y="372" textAnchor="middle" className="font-serif" fontSize="11" fill="var(--color-ink-950)">Public evidence comes in.</text>
        <text x="126" y="388" textAnchor="middle" className="font-serif" fontSize="11" fill="var(--color-ink-950)">Private data stays in.</text>
      </svg>

      <figcaption className="mx-auto min-h-[48px] max-w-[470px] text-center text-[11px] leading-relaxed text-ink-500" aria-live="polite">
        {detail ? (
          <><span className="font-mono font-semibold uppercase tracking-[0.12em] text-ink-950">{detail.title}</span><br />{detail.body}</>
        ) : (
          <><span className="font-mono font-semibold uppercase tracking-[0.12em] text-ink-950">The Sovereign Decision Circuit</span><br />The hardware, the data and the release decision remain under government control.</>
        )}
      </figcaption>
    </figure>
  );
}