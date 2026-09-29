import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Stage = "understand" | "rehearse" | "decide" | "deliver" | "learn";

const STAGES: Array<{ id: Stage; number: string; title: string; body: string; x: number; y: number }> = [
  { id: "understand", number: "01", title: "Understand", body: "Authorised officials review sourced national evidence inside the country-controlled boundary.", x: 68, y: 77 },
  { id: "rehearse", number: "02", title: "Rehearse", body: "Options are tested without moving the underlying national record outside government control.", x: 311, y: 77 },
  { id: "decide", number: "03", title: "Decide", body: "A named decision and its conditions are recorded against the evidence used.", x: 344, y: 190 },
  { id: "deliver", number: "04", title: "Deliver", body: "The authorised instruction advances while protected evidence remains in national custody.", x: 195, y: 255 },
  { id: "learn", number: "05", title: "Learn", body: "Results return to the national record, strengthening the next decision without surrendering control.", x: 45, y: 190 },
];

export function NationalCustodyRelay() {
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
    const timer = window.setTimeout(() => setCycle((current) => current + 1), 9_500);
    return () => window.clearTimeout(timer);
  }, [visible, active, cycle]);

  const stageProps = (stage: Stage) => ({
    tabIndex: 0,
    role: "button" as const,
    "aria-label": `${STAGES.find((item) => item.id === stage)?.title}. ${STAGES.find((item) => item.id === stage)?.body}`,
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

  const detail = STAGES.find((stage) => stage.id === active);

  return (
    <figure
      ref={ref}
      className={`ncr w-full max-w-[390px] select-none ${visible ? "ncr-on" : ""} ${active ? "ncr-paused" : ""}`}
      aria-label="The National Custody Relay shows evidence remaining in a national register while authorised actions move through five stages of a government decision."
    >
      <svg key={cycle} viewBox="0 0 390 300" className="block h-auto w-full overflow-visible">
        <title>National evidence remains under national control through every stage of a decision</title>
        <defs>
          <pattern id="ncr-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-ink-700)" strokeWidth="0.5" opacity="0.28" />
          </pattern>
        </defs>

        <g className="ncr-boundary">
          <circle cx="195" cy="145" r="116" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M107 66 A116 116 0 0 1 283 66" fill="none" stroke="var(--color-ink-300)" strokeWidth="0.7" />
          <rect x="128" y="17" width="134" height="20" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
          <text x="195" y="30" textAnchor="middle" className="font-mono" fontSize="6.8" fill="var(--color-ink-950)">NATIONAL CONTROL BOUNDARY</text>
        </g>

        <g className="ncr-register">
          <circle cx="195" cy="145" r="50" fill="url(#ncr-hatch)" stroke="var(--color-ink-950)" strokeWidth="1" />
          <circle cx="195" cy="145" r="39" fill="var(--color-paper-0)" stroke="var(--color-ink-700)" strokeWidth="0.8" />
          <path d="M174 126 h42 v38 h-42 z M181 135 h28 M181 143 h22 M181 151 h26" fill="none" stroke="var(--color-ink-700)" strokeWidth="0.8" />
          <text x="195" y="179" textAnchor="middle" className="font-mono" fontSize="6.2" fill="var(--color-ink-950)">NATIONAL EVIDENCE</text>
          <text x="195" y="188" textAnchor="middle" className="font-mono" fontSize="5.3" fill="var(--color-ink-500)">REMAINS HERE</text>
        </g>

        <path className="ncr-relay-path" d="M68 77 C128 34 261 34 311 77 C355 113 364 157 344 190 C315 239 254 259 195 255 C128 259 68 237 45 190 C25 148 33 106 68 77 Z" fill="none" stroke="var(--color-gold-500)" strokeWidth="1.4" pathLength="1" />

        {STAGES.map((stage, index) => (
          <g key={stage.id} className="ncr-stage" data-stage={stage.id} {...stageProps(stage.id)}>
            <circle cx={stage.x} cy={stage.y} r="17" fill="var(--color-paper-0)" stroke="var(--color-ink-950)" strokeWidth="0.9" />
            <circle className="ncr-authorised" cx={stage.x} cy={stage.y} r="12" fill="var(--color-paper-0)" stroke="var(--color-gold-500)" strokeWidth="1.1" />
            <text x={stage.x} y={stage.y + 2.5} textAnchor="middle" className="font-mono" fontSize="7" fill="var(--color-ink-950)">{stage.number}</text>
            <text x={stage.x} y={stage.y + (index === 3 ? -27 : index === 0 || index === 1 ? -25 : 30)} textAnchor="middle" className="font-mono" fontSize="6.2" fill="var(--color-ink-700)">{stage.title.toUpperCase()}</text>
            <path className="ncr-custody-mark" d={`M${stage.x - 4} ${stage.y} l3 3 6 -7`} fill="none" stroke="var(--color-gold-500)" strokeWidth="1.2" />
          </g>
        ))}

        <g className="ncr-resolution">
          <path d="M82 282 C147 277 238 287 309 280" fill="none" stroke="var(--color-ink-300)" strokeWidth="0.7" />
          <text x="195" y="295" textAnchor="middle" className="font-serif" fontSize="10.5" fill="var(--color-ink-950)">The decision moves. The evidence stays.</text>
        </g>
      </svg>

      <figcaption className="mx-auto min-h-[44px] max-w-[360px] text-center text-[11px] leading-relaxed text-ink-500" aria-live="polite">
        {detail ? (
          <><span className="font-mono font-semibold uppercase text-ink-950">{detail.title}</span><br />{detail.body}</>
        ) : (
          <><span className="font-mono font-semibold uppercase text-ink-950">The National Custody Relay</span><br />National evidence stays under national control through every authorised decision stage.</>
        )}
      </figcaption>
    </figure>
  );
}