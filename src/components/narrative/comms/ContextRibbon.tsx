import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Radio, Target, Users } from "lucide-react";

export function ContextRibbon({
  code,
  signal,
  strategyId,
  channel,
  audience,
}: {
  code: string;
  signal: { id: string; topic: string | null } | null;
  strategyId: string | null;
  channel: string;
  audience: string;
}) {
  return (
    <div className="border border-line-200 bg-paper-0 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
      {signal && (
        <Link
          to="/admin/countries/$code/narrative/signal/$id"
          params={{ code, id: signal.id }}
          className="group inline-flex items-center gap-1.5 text-ink-700 hover:text-ink-950"
        >
          <Radio size={11} className="text-amber-600" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink-500">Signal</span>
          <span className="max-w-[260px] truncate">{signal.topic ?? "Untitled signal"}</span>
          <ArrowUpRight size={11} className="opacity-0 transition group-hover:opacity-100" />
        </Link>
      )}
      {strategyId && (
        <span className="inline-flex items-center gap-1.5 text-ink-700">
          <Target size={11} className="text-sky-700" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink-500">Strategy</span>
          <span>Position drafted</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-ink-700">
        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-500">Channel</span>
        <span>{channel.replace(/[_-]/g, " ")}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-ink-700">
        <Users size={11} className="text-ink-500" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-500">Audience</span>
        <span>{audience || "—"}</span>
      </span>
    </div>
  );
}
