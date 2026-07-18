import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function GuidanceBanner({
  message,
  tone = "info",
  cta,
}: {
  message: string;
  tone?: "info" | "success";
  cta?: { label: string; onClick: () => void; icon?: "sparkles" | "arrow" };
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border px-4 py-2.5 text-sm",
        tone === "success"
          ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-900"
          : "border-line-200 bg-paper-100/50 text-ink-950",
      )}
    >
      <p className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 items-center border px-1.5 font-mono text-[9px] uppercase tracking-[0.2em]",
            tone === "success"
              ? "border-emerald-500/60 text-emerald-800"
              : "border-line-200 text-ink-500",
          )}
        >
          Next
        </span>
        <span>{message}</span>
      </p>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="inline-flex items-center gap-1.5 border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950 transition-colors hover:bg-ink-950 hover:text-paper-0"
        >
          {cta.icon === "sparkles" && <Sparkles size={12} />}
          {cta.label}
          {cta.icon !== "sparkles" && <ArrowRight size={12} />}
        </button>
      )}
    </div>
  );
}
