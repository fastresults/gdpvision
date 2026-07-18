import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Session Mode day clock: "signal ingested at HH:MM → target publish 17:00".
 * Turns amber < 2h, red at overrun.
 */
export function DayClock({ startedAt, deadlineHour = 17 }: { startedAt: string; deadlineHour?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(startedAt);
  const deadline = new Date(start);
  deadline.setHours(deadlineHour, 0, 0, 0);
  if (deadline.getTime() <= start.getTime()) deadline.setDate(deadline.getDate() + 1);
  const msLeft = deadline.getTime() - now;
  const hoursLeft = msLeft / 3_600_000;

  const tone =
    hoursLeft < 0 ? "over" : hoursLeft < 2 ? "warn" : "ok";

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]",
        tone === "over"
          ? "border-rose-500/50 bg-rose-50 text-rose-700"
          : tone === "warn"
            ? "border-amber-500/50 bg-amber-50 text-amber-800"
            : "border-line-200 bg-paper-100/60 text-ink-700",
      )}
      title="Session Mode: signal → statement inside a working day"
    >
      <Clock size={12} />
      <span>Signal {fmt(start)}</span>
      <span className="text-ink-500">→</span>
      <span>Publish by {fmt(deadline)}</span>
      <span className="ml-1 rounded-sm bg-paper-0 px-1.5 py-0.5 text-ink-950">
        {hoursLeft < 0
          ? `+${Math.abs(hoursLeft).toFixed(1)}h over`
          : `${hoursLeft.toFixed(1)}h left`}
      </span>
    </div>
  );
}
