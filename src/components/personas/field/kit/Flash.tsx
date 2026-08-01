// Chamber 07 · Field desk · outcome feedback that can be seen.
//
// Success and failure used to land as 12px grey text below the fold of a
// panel. A decision the operator just took deserves a visible answer.

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

export type FlashTone = "working" | "done" | "attention";

export function Flash({
  tone = "done",
  message,
  onClear,
  className,
}: {
  tone?: FlashTone;
  message: string | null;
  /** Success notes clear themselves; failures stay until replaced. */
  onClear?: () => void;
  className?: string;
}) {
  useEffect(() => {
    if (!message || tone !== "done" || !onClear) return;
    const t = setTimeout(onClear, 6_000);
    return () => clearTimeout(t);
  }, [message, tone, onClear]);

  if (!message) return null;
  const Icon = tone === "working" ? Loader2 : tone === "attention" ? AlertTriangle : CheckCircle2;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-1 mt-3 flex items-start gap-2 border p-2.5 text-[12px] leading-relaxed duration-150",
        tone === "attention"
          ? "border-ink-950 bg-paper-50 text-ink-900"
          : "border-line-200 bg-paper-50 text-ink-700",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "working" && "animate-spin")}
      />
      <span>{message}</span>
    </p>
  );
}

/** A copy control that confirms it copied. */
export function useCopyFeedback(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useStateSafe();
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => setCopied(true));
  };
  return [copied, copy];
}

// Small local hook so the flag resets itself without a second import site.
import { useState } from "react";
function useStateSafe(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!v) return;
    const t = setTimeout(() => setV(false), 2_000);
    return () => clearTimeout(t);
  }, [v]);
  return [v, setV];
}
