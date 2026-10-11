import { cn } from "@/lib/utils";

/**
 * One line-drawn glyph per chamber, in the instrument register: hairline ink
 * strokes with a single accent mark. Used on the chamber grid and the chamber
 * steps in the live briefing. Indexed by the chamber's two-digit code.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function glyph(index: string, accent: string) {
  switch (index) {
    case "01": // The National Ledger: a ruled page with a seal
      return (
        <>
          <rect x={11} y={7} width={26} height={34} rx={2} {...STROKE} />
          <path d="M17 16h14M17 22h14M17 28h9" {...STROKE} />
          <circle cx={31} cy={33} r={3.5} fill={accent} />
        </>
      );
    case "02": // Portfolio Workspaces: a folder with bars inside
      return (
        <>
          <path
            d="M8 14a2 2 0 0 1 2-2h9l3 4h16a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z"
            {...STROKE}
          />
          <path d="M16 34v-6M22 34v-10M28 34v-4" {...STROKE} />
          <rect x={33} y={22} width={3} height={12} rx={1} fill={accent} />
        </>
      );
    case "03": // The Scenario Engine: branching paths from one point
      return (
        <>
          <path d="M8 24h10" {...STROKE} />
          <path d="M18 24c6 0 6-10 12-10h10M18 24h22M18 24c6 0 6 10 12 10h10" {...STROKE} />
          <circle cx={18} cy={24} r={2.5} fill={accent} />
        </>
      );
    case "04": // The FDI Transition Studio: capital arriving on a plot
      return (
        <>
          <path d="M9 31l15 7 15-7-15-7z" {...STROKE} />
          <path d="M24 8v16" {...STROKE} />
          <path d="M18 18l6 6 6-6" {...STROKE} />
          <circle cx={24} cy={31} r={2.5} fill={accent} />
        </>
      );
    case "05": // The Narrative Chamber: a sourced statement
      return (
        <>
          <path d="M12 12h24v18H22l-7 6v-6h-3z" {...STROKE} />
          <path d="M18 19h12M18 24h8" {...STROKE} />
          <circle cx={31} cy={24} r={2} fill={accent} />
        </>
      );
    case "06": // The Cabinet Room: the table and the seats
      return (
        <>
          <circle cx={24} cy={24} r={8} {...STROKE} />
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            return (
              <circle
                key={deg}
                cx={24 + Math.cos(a) * 15}
                cy={24 + Math.sin(a) * 15}
                r={2.6}
                fill={i === 0 ? accent : "currentColor"}
              />
            );
          })}
        </>
      );
    case "07": // The Persona Lab: the people a policy meets
      return (
        <>
          <circle cx={24} cy={16} r={5} {...STROKE} />
          <path d="M15 36c0-6 4-9 9-9s9 3 9 9" {...STROKE} />
          <circle cx={11} cy={19} r={3.5} {...STROKE} />
          <path d="M4 33c0-4 3-7 7-7" {...STROKE} />
          <circle cx={37} cy={19} r={3.5} fill={accent} />
          <path d="M44 33c0-4-3-7-7-7" {...STROKE} />
        </>
      );
    case "08": // The Mandate Compact: pledges with boxes to tick
      return (
        <>
          <rect x={10} y={8} width={28} height={32} rx={2} {...STROKE} />
          <rect x={15} y={14} width={5} height={5} rx={1} {...STROKE} />
          <rect x={15} y={23} width={5} height={5} rx={1} {...STROKE} />
          <rect x={15} y={32} width={5} height={5} rx={1} fill={accent} />
          <path d="M24 16.5h9M24 25.5h9M24 34.5h6" {...STROKE} />
        </>
      );
    case "09": // The Digital Government Studio: a service behind a shield
      return (
        <>
          <path d="M24 6l14 5v12c0 9-6 15-14 19C16 38 10 32 10 23V11z" {...STROKE} />
          <path d="M17 24h14M24 17v14" {...STROKE} />
          <circle cx={24} cy={24} r={2.5} fill={accent} />
        </>
      );
    case "10": // The Sector Studio: the sector wheel, one chosen
      return (
        <>
          <circle cx={24} cy={24} r={16} {...STROKE} />
          <path d="M24 8v16l16 0M24 24l-8 14M24 24l-14-8" {...STROKE} />
          <path d="M24 24L24 8A16 16 0 0 1 40 24z" fill={accent} opacity={0.9} />
        </>
      );
    default:
      return <circle cx={24} cy={24} r={14} {...STROKE} />;
  }
}

export function ChamberGlyph({
  index,
  accentVar,
  className,
  size = 40,
}: {
  index: string;
  accentVar: string;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("block text-ink-800", className)}
      aria-hidden
    >
      {glyph(index, `var(${accentVar})`)}
    </svg>
  );
}
