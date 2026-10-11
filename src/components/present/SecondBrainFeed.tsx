import { useEffect, useRef, useState } from "react";
import { MEASURING_BODIES } from "@/lib/marketing/global-indexes";
import { SignatureRing } from "@/components/marketing/SignatureRing";
import { cn } from "@/lib/utils";

/**
 * The Second Brain, fed. Public measuring bodies stream in from the left;
 * private national data sits behind the sovereign wall on the right and only
 * approved findings cross. Pure SVG + SMIL particles + CSS reveals
 * (see `.prs-*` in src/styles.css). Starts when scrolled into view.
 */

const W = 1400;
const H = 720;
const CX = W / 2;
const CY = H / 2;
const BRAIN_R = 170;
const WALL_X = 930;

const PUBLIC = [...MEASURING_BODIES.map((b) => b.short), "ECCB", "National statistics offices"];

const PRIVATE = [
  "VAT receipts",
  "Customs manifests",
  "Arrivals, by carrier",
  "Ministry records",
  "Payroll and licences",
  "Cabinet papers",
];

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function SecondBrainFeed({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && (setOn(true), io.disconnect()),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pubY = (i: number) => 70 + (i * (H - 140)) / (PUBLIC.length - 1);
  const privY = (i: number) => 150 + (i * (H - 300)) / (PRIVATE.length - 1);
  const brainLeft = CX - BRAIN_R - 10;
  const brainRight = CX + BRAIN_R + 10;
  const vaultX = WALL_X + 50;
  const privX = 1180;
  const vaultY = CY - 120;
  const vaultW = 130;
  const vaultH = 240;

  return (
    <div
      ref={ref}
      className={cn("relative w-full", on && "is-on", className)}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Public measuring bodies feed the Second Brain from the left. Private national data stays behind the sovereign wall on the right; only approved findings cross."
      >
        <defs>
          <marker
            id="prs-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" fill="var(--ink-400)" />
          </marker>
        </defs>

        {/* Public streams */}
        {PUBLIC.map((name, i) => {
          const y = pubY(i);
          const d = curve(300, y, brainLeft, CY + (i - (PUBLIC.length - 1) / 2) * 14);
          return (
            <g key={name} className="prs-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <text x={290} y={y + 5} textAnchor="end" className="prs-label" fill="var(--ink-700)">
                {name}
              </text>
              <circle cx={300} cy={y} r={4} fill="var(--ink-400)" />
              <path d={d} fill="none" stroke="var(--line-200)" strokeWidth={1.25} />
              <path
                d={d}
                fill="none"
                stroke="var(--ink-400)"
                strokeWidth={1.25}
                className="prs-draw"
                style={{ animationDelay: `${300 + i * 90}ms` }}
              />
              <circle r={3.2} fill="var(--ink-800)">
                <animateMotion
                  dur={`${5.5 + (i % 4) * 0.7}s`}
                  begin={`${1.2 + i * 0.35}s`}
                  repeatCount="indefinite"
                  path={d}
                />
              </circle>
            </g>
          );
        })}

        {/* Private streams into the Vault */}
        {PRIVATE.map((name, i) => {
          const y = privY(i);
          const d = curve(
            privX,
            y,
            vaultX + vaultW,
            vaultY + 30 + (i * (vaultH - 60)) / (PRIVATE.length - 1),
          );
          return (
            <g key={name} className="prs-rise" style={{ animationDelay: `${600 + i * 110}ms` }}>
              <text
                x={privX + 14}
                y={y + 5}
                textAnchor="start"
                className="prs-label"
                fill="var(--ink-700)"
              >
                {name}
              </text>
              <circle cx={privX} cy={y} r={4} fill="var(--gold-500, #b98a2f)" />
              <path d={d} fill="none" stroke="var(--line-200)" strokeWidth={1.25} />
              <path
                d={d}
                fill="none"
                stroke="var(--gold-500, #b98a2f)"
                strokeWidth={1.25}
                className="prs-draw"
                style={{ animationDelay: `${900 + i * 110}ms` }}
              />
              <circle r={3.2} fill="var(--gold-500, #b98a2f)">
                <animateMotion
                  dur={`${4.5 + (i % 3) * 0.6}s`}
                  begin={`${2 + i * 0.4}s`}
                  repeatCount="indefinite"
                  path={d}
                />
              </circle>
            </g>
          );
        })}

        {/* The Vault */}
        <g className="prs-rise" style={{ animationDelay: "1400ms" }}>
          <rect
            x={vaultX}
            y={vaultY}
            width={vaultW}
            height={vaultH}
            rx={10}
            fill="var(--paper-0)"
            stroke="var(--gold-500, #b98a2f)"
            strokeWidth={2}
          />
          {[0, 1, 2, 3].map((k) => (
            <rect
              key={k}
              x={vaultX + 22}
              y={vaultY + 40 + k * 46}
              width={vaultW - 44}
              height={22}
              rx={3}
              fill="none"
              stroke="var(--line-200)"
            />
          ))}
          <circle
            cx={vaultX + vaultW - 30}
            cy={vaultY + vaultH - 28}
            r={5}
            className="prs-light"
            fill="var(--gold-500, #b98a2f)"
          />
          <text
            x={vaultX + vaultW / 2}
            y={vaultY - 16}
            textAnchor="middle"
            className="prs-label"
            fill="var(--ink-700)"
          >
            THE VAULT · IN-COUNTRY
          </text>
          <text
            x={vaultX + vaultW / 2}
            y={vaultY + vaultH + 28}
            textAnchor="middle"
            className="prs-label"
            fill="var(--ink-500)"
          >
            GOVERNMENT-HELD HARDWARE
          </text>
        </g>

        {/* The sovereign wall */}
        <g className="prs-rise" style={{ animationDelay: "1700ms" }}>
          <text x={WALL_X} y={24} textAnchor="middle" className="prs-label" fill="var(--ink-800)">
            APPROVED FINDINGS ONLY · TWO NAMED OFFICIALS
          </text>
          <line
            x1={WALL_X}
            y1={40}
            x2={WALL_X}
            y2={H - 40}
            stroke="var(--ink-800)"
            strokeWidth={3}
            strokeDasharray="14 10"
            className="prs-wall"
          />
          <text x={W - 24} y={H - 12} textAnchor="end" className="prs-label" fill="var(--ink-800)">
            SOVEREIGN BOUNDARY · PRIVATE ROWS NEVER CROSS
          </text>
        </g>

        {/* Approved findings only: Vault → brain, across the wall */}
        <g className="prs-rise" style={{ animationDelay: "2200ms" }}>
          <path
            d={curve(vaultX, CY, brainRight, CY)}
            fill="none"
            stroke="var(--ink-800)"
            strokeWidth={2}
            markerEnd="url(#prs-arrow)"
          />

          <circle r={4} fill="var(--ink-950)">
            <animateMotion
              dur="3.6s"
              begin="3s"
              repeatCount="indefinite"
              path={curve(vaultX, CY, brainRight, CY)}
            />
          </circle>
        </g>

        {/* Brain caption */}
        <g className="prs-rise" style={{ animationDelay: "2600ms" }}>
          <text x={24} y={H - 12} textAnchor="start" className="prs-label" fill="var(--ink-700)">
            THE SECOND BRAIN · EVERY FIGURE CARRIES SOURCE, METHOD, GRADE AND DATE
          </text>
        </g>
      </svg>

      {/* The brain itself: the National Signature ring with the constellation inside */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${((CX - BRAIN_R) / W) * 100}%`,
          top: `${((CY - BRAIN_R) / H) * 100}%`,
          width: `${((BRAIN_R * 2) / W) * 100}%`,
        }}
      >
        <div className="translate-y-1/4">
          <SignatureRing size={BRAIN_R * 2} animate showBrain className="prs-breathe" />
        </div>
      </div>
    </div>
  );
}
