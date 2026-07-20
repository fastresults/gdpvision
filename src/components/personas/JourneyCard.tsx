import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  n: number;
  icon: LucideIcon;
  title: string;
  purpose: string;
  count: number;
  countLabel: string;
  cta: string;
  to: string;
  params: Record<string, string>;
  disabled?: boolean;
  disabledHint?: string;
  currentHere?: boolean;
  extra?: ReactNode;
};

export function JourneyCard({
  n,
  icon: Icon,
  title,
  purpose,
  count,
  countLabel,
  cta,
  to,
  params,
  disabled,
  disabledHint,
  currentHere,
  extra,
}: Props) {
  const status =
    currentHere ? "here" : count > 0 ? "ready" : disabled ? "locked" : "empty";
  const statusColor =
    status === "ready"
      ? "bg-emerald-500"
      : status === "here"
        ? "bg-ink-950"
        : status === "locked"
          ? "bg-ink-300"
          : "bg-amber-500";


  const inner = (
    <div
      className={`group relative flex h-full flex-col border p-5 transition ${
        disabled
          ? "border-line-200 bg-paper-100/40 opacity-70"
          : "border-line-200 bg-paper-0 hover:border-ink-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Stage {n.toString().padStart(2, "0")}
        </p>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
          <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} /> {status}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Icon size={18} className="text-ink-950" />
        <h3 className="font-serif text-xl text-ink-950">{title}</h3>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{purpose}</p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
        {count} {countLabel}
      </p>
      {extra}
      <div className="mt-auto pt-4">
        {disabled ? (
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
            <Lock size={11} /> {disabledHint ?? "Locked"}
          </p>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950 group-hover:gap-2 transition-all">
            {cta} <ArrowRight size={12} />
          </span>
        )}
      </div>
    </div>
  );

  if (disabled) return inner;
  return (
    <Link to={to} params={params} className="block h-full">
      {inner}
    </Link>
  );
}
