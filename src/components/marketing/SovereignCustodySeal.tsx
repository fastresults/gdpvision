import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Stage = "evidence" | "access" | "custody" | "release";

const STAGE_COPY: Record<Stage, { title: string; body: string }> = {
  evidence: {
    title: "National evidence enters",
    body: "Government records enter a country-controlled boundary and remain part of the national record.",
  },
  access: {
    title: "Access follows national rules",
    body: "Authorised officials pass the role gate. Other routes remain closed.",
  },
  custody: {
    title: "Every action leaves a record",
    body: "Access, review and change marks build a visible chain of custody inside the boundary.",
  },
  release: {
    title: "Government authorises release",
    body: "A named approval may release a finding. The underlying national evidence stays under national control.",
  },
};

export function SovereignCustodySeal() {
  const ref = useRef<HTMLElement>(null);
  const wasVisible = useRef(false);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<Stage | null>(null);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = Boolean(entry?.isIntersecting);
        if (nextVisible && !wasVisible.current) setCycle((current) => current + 1);
        wasVisible.current = nextVisible;
        setVisible(nextVisible);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setCycle((current) => current + 1), 10_200);
    return () => window.clearTimeout(timer);
  }, [visible, active, cycle]);

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
      className={`scs mt-12 w-full max-w-[390px] select-none ${visible ? "scs-on" : ""} ${active ? "scs-paused" : ""}`}
      aria-label="The Sovereign Custody Seal shows national evidence entering a country-controlled boundary, authorised access being recorded, and only an approved finding leaving."
    >
      <svg key={cycle} viewBox="0 0 390 320" className="block h-auto w-full overflow-visible">
        <title>National evidence remains under national control</title>
        <defs>
          <pattern id="scs-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-ink-700)" strokeWidth="0.5" opacity="0.3" />
          </pattern>
          <pattern id="scs-hatch-dense" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-42)">
            <line x1="0" y1="0" x2="0" y2="3.5" stroke="var(--color-ink-950)" strokeWidth="0.5" opacity="0.24" />
          </pattern>
        </defs>

        <g className="scs-boundary">
          <path d="M116 35 H331 V249 H116 Z" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1.1" strokeDasharray="4 4" />
          <path d="M132 24 H315 V47 H132 Z" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="0.9" />
          <text x="224" y="39" textAnchor="middle" className="font-mono" fontSize="7.2" fill="var(--color-ink-950)">NATIONAL CONTROL BOUNDARY</text>
        </g>

        <g className="scs-evidence" {...stageProps("evidence")}>
          <text x="15" y="72" className="font-mono" fontSize="7" fill="var(--color-ink-500)">NATIONAL EVIDENCE</text>
          {[0, 1, 2].map((index) => (
            <g key={index} className="scs-document" style={{ ["--i" as string]: index }}>
              <rect x={20 + index * 12} y={91 + index * 35} width="42" height="29" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.8" />
              <path d={`M${27 + index * 12} ${101 + index * 35} h27 M${27 + index * 12} ${108 + index * 35} h20`} stroke="var(--color-ink-500)" strokeWidth="0.65" />
            </g>
          ))}
          <path className="scs-entry-path" d="M73 140 C92 140 102 140 121 140" fill="none" stroke="var(--color-ink-700)" strokeWidth="1.2" pathLength="1" />
          <path className="scs-entry-arrow" d="M115 135 l7 5 -7 5" fill="none" stroke="var(--color-ink-700)" strokeWidth="1" />
        </g>

        <g className="scs-access" {...stageProps("access")}>
          <rect x="131" y="84" width="66" height="111" fill="url(#scs-hatch)" stroke="var(--color-ink-950)" strokeWidth="1" />
          <text x="164" y="99" textAnchor="middle" className="font-mono" fontSize="6.3" fill="var(--color-ink-950)">ROLE GATE</text>
          <path d="M145 120 h38 v51 h-38 z" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.8" />
          <circle cx="164" cy="137" r="8" fill="none" stroke="var(--color-ink-700)" strokeWidth="0.8" />
          <path d="M151 161 c2 -11 24 -11 26 0" fill="none" stroke="var(--color-ink-700)" strokeWidth="0.8" />
          <g className="scs-authorised">
            <circle cx="187" cy="181" r="8" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1" />
            <path d="M183 181 l3 3 5 -7" fill="none" stroke="var(--color-gold-500)" strokeWidth="1.2" />
          </g>
          <g className="scs-denied">
            <path d="M137 211 h50" stroke="var(--color-ink-300)" strokeWidth="0.8" strokeDasharray="3 3" />
            <path d="M158 205 l12 12 M170 205 l-12 12" stroke="var(--color-ink-500)" strokeWidth="1" />
            <text x="162" y="229" textAnchor="middle" className="font-mono" fontSize="5.8" fill="var(--color-ink-500)">OTHER ROUTES CLOSED</text>
          </g>
        </g>

        <g className="scs-custody" {...stageProps("custody")}>
          <circle cx="249" cy="137" r="56" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1" />
          <circle cx="249" cy="137" r="46" fill="url(#scs-hatch-dense)" stroke="var(--color-ink-700)" strokeWidth="0.7" />
          <circle cx="249" cy="137" r="32" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.7" />
          {[0, 1, 2, 3, 4].map((index) => {
            const angle = (-132 + index * 66) * (Math.PI / 180);
            const x = 249 + Math.cos(angle) * 39;
            const y = 137 + Math.sin(angle) * 39;
            return <circle key={index} className="scs-custody-mark" cx={x} cy={y} r="3.2" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1" style={{ ["--i" as string]: index }} />;
          })}
          <path className="scs-seal-line" d="M224 137 h50 M249 112 v50" stroke="var(--color-ink-700)" strokeWidth="0.7" pathLength="1" />
          <text x="249" y="134" textAnchor="middle" className="font-mono" fontSize="6.5" fill="var(--color-ink-950)">CUSTODY</text>
          <text x="249" y="146" textAnchor="middle" className="font-mono" fontSize="5.5" fill="var(--color-ink-500)">RECORDED</text>
          <text x="249" y="216" textAnchor="middle" className="font-mono" fontSize="6.2" fill="var(--color-ink-700)">NATIONAL RECORD STAYS INSIDE</text>
        </g>

        <g className="scs-release" {...stageProps("release")}>
          <path className="scs-release-path" d="M297 137 C322 137 334 137 350 137" fill="none" stroke="var(--color-gold-500)" strokeWidth="1.4" pathLength="1" />
          <g className="scs-approval-mark">
            <circle cx="318" cy="155" r="8" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1" />
            <path d="M314 155 l3 3 5 -7" fill="none" stroke="var(--color-gold-500)" strokeWidth="1.2" />
          </g>
          <g className="scs-finding">
            <rect x="347" y="118" width="38" height="38" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1" />
            <path d="M353 128 h25 M353 135 h20 M353 142 h23" stroke="var(--color-gold-500)" strokeWidth="0.65" />
            <text x="366" y="170" textAnchor="middle" className="font-mono" fontSize="5.8" fill="var(--color-ink-500)">APPROVED FINDING</text>
          </g>
        </g>

        <g className="scs-resolution">
          <path d="M43 270 C122 265 202 274 347 267" fill="none" stroke="var(--color-ink-300)" strokeWidth="0.7" />
          <text x="195" y="291" textAnchor="middle" className="font-serif" fontSize="12" fill="var(--color-ink-950)">Held nationally. Access governed.</text>
          <text x="195" y="307" textAnchor="middle" className="font-mono" fontSize="7" fill="var(--color-gold-500)">RELEASE AUTHORISED</text>
        </g>
      </svg>

      <figcaption className="mx-auto min-h-[48px] max-w-[360px] text-center text-[11px] leading-relaxed text-ink-500" aria-live="polite">
        {detail ? (
          <><span className="font-mono font-semibold uppercase text-ink-950">{detail.title}</span><br />{detail.body}</>
        ) : (
          <><span className="font-mono font-semibold uppercase text-ink-950">The Sovereign Custody Seal</span><br />Government controls the evidence, the access rules and every authorised release.</>
        )}
      </figcaption>
    </figure>
  );
}