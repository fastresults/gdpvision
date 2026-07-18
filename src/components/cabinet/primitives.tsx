// Small visual primitives for Chamber 06 — Cabinet Room.
import { AlertTriangle, ShieldCheck, ShieldAlert, Activity } from "lucide-react";

export function ReadinessRing({ value, size = 88, label = "Ready" }: { value: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const off = c - (pct / 100) * c;
  const stroke = pct >= 75 ? "var(--color-emerald-500, #10b981)" : pct >= 40 ? "var(--color-gold-500, #c9a84c)" : "var(--color-ink-500, #6b7280)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity={0.12} strokeWidth={8} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={stroke} strokeWidth={8} strokeLinecap="round"
          fill="none" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 400ms ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-serif text-xl leading-none tabular-nums">{Math.round(pct)}%</div>
        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-500">{label}</div>
      </div>
    </div>
  );
}

type Posture = "strong" | "watch" | "stressed" | string;
export function PostureBadge({ label, posture }: { label: string; posture: Posture }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; word: string }> = {
    strong: { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700", icon: <ShieldCheck size={12} />, word: "Strong" },
    watch: { cls: "border-gold-500/40 bg-gold-500/10 text-gold-700", icon: <Activity size={12} />, word: "Watch" },
    stressed: { cls: "border-red-500/40 bg-red-500/10 text-red-700", icon: <ShieldAlert size={12} />, word: "Stressed" },
  };
  const p = map[posture] ?? { cls: "border-line-200 bg-paper-100 text-ink-500", icon: <AlertTriangle size={12} />, word: "—" };
  return (
    <div className={`inline-flex items-center gap-1.5 border px-2 py-1 ${p.cls}`}>
      {p.icon}
      <span className="font-mono text-[9px] uppercase tracking-[0.22em]">{label}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] opacity-70">· {p.word}</span>
    </div>
  );
}

export function ImpactBar({ impact, confidence }: { impact: number; confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line-200">
        <div className="h-full bg-ink-950" style={{ width: `${Math.max(0, Math.min(100, impact))}%` }} />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] tabular-nums text-ink-500">
        {Math.round(impact)}·{Math.round(confidence)}
      </span>
    </div>
  );
}

export function Countdown({ target }: { target: string | null }) {
  if (!target) return <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Unscheduled</span>;
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-600">Overdue</span>;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 tabular-nums">
      {d > 0 ? `${d}d ${h}h` : `${h}h`} to session
    </span>
  );
}
