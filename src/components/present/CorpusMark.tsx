import { useQuery } from "@tanstack/react-query";
import {
  CORPUS_FALLBACK,
  getCorpusSnapshot,
  type CorpusCounts,
} from "@/lib/present/corpus-snapshot.functions";

/**
 * The real Second Brain, drawn small: five clusters (sources, documents,
 * chunks, memories, KPIs) whose density follows the live corpus counts.
 * Aggregate counts only. Used wherever the briefing draws the Second Brain.
 */

const KEYS: (keyof CorpusCounts)[] = ["sources", "documents", "chunks", "memories", "kpis"];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function useCorpusCounts() {
  const { data } = useQuery({
    queryKey: ["present", "corpus-snapshot"],
    queryFn: () => getCorpusSnapshot(),
    staleTime: 10 * 60_000,
  });
  return data ?? CORPUS_FALLBACK;
}

export function CorpusMark({
  x,
  y,
  r,
  accent = "var(--gold-500)",
  highlight,
  label = true,
}: {
  x: number;
  y: number;
  r: number;
  accent?: string;
  /** 1-based chamber index; its cluster glows in the accent. */
  highlight?: number | string;
  label?: boolean;
}) {
  const counts = useCorpusCounts();
  const hi = highlight != null ? (Number(highlight) - 1) % KEYS.length : -1;
  const total = KEYS.reduce((a, k) => a + counts[k], 0);

  const dots: { cx: number; cy: number; c: number; big: boolean }[] = [];
  KEYS.forEach((k, c) => {
    const n = Math.max(4, Math.min(18, Math.round(Math.log10(counts[k] + 10) * 4)));
    const a0 = (c / KEYS.length) * Math.PI * 2 - Math.PI / 2;
    const rnd = rand(c * 97 + 13);
    for (let i = 0; i < n; i++) {
      const a = a0 + (rnd() - 0.5) * 1.1;
      const d = r * (0.25 + rnd() * 0.62);
      dots.push({ cx: x + Math.cos(a) * d, cy: y + Math.sin(a) * d, c, big: i === 0 });
    }
  });
  const hubs = KEYS.map((_, c) => {
    const a = (c / KEYS.length) * Math.PI * 2 - Math.PI / 2;
    return { cx: x + Math.cos(a) * r * 0.5, cy: y + Math.sin(a) * r * 0.5 };
  });

  return (
    <g aria-label={`Second Brain: ${total.toLocaleString()} records across sources, documents, passages, memories and indicators`}>
      <circle cx={x} cy={y} r={r} fill="var(--paper-0)" stroke="var(--ink-950)" strokeWidth={1.5} />
      <circle cx={x} cy={y} r={r - 6} fill="none" stroke="var(--line-200)" strokeDasharray="2 4" />
      {hubs.map((h, c) => (
        <line
          key={`l${c}`}
          x1={x}
          y1={y}
          x2={h.cx}
          y2={h.cy}
          stroke={c === hi ? accent : "var(--line-200)"}
          strokeWidth={0.8}
        />
      ))}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.big ? 2.4 : 1.3}
          fill={d.c === hi ? accent : "var(--ink-500)"}
          opacity={d.c === hi ? 1 : 0.75}
          className={d.big ? "prs-light" : undefined}
          style={d.big ? { animationDelay: `${d.c * 500}ms` } : undefined}
        />
      ))}
      <circle cx={x} cy={y} r={3.2} fill={hi >= 0 ? accent : "var(--ink-950)"} className="prs-light" />
      {label && (
        <text x={x} y={y + r + 24} textAnchor="middle" className="prs-label" fill="var(--ink-700)">
          SECOND BRAIN
        </text>
      )}
    </g>
  );
}
