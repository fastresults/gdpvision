import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  value: string | (() => string);
  label?: string;
  successMessage?: string;
  className?: string;
  iconSize?: number;
  variant?: "icon" | "chip" | "ghost";
  title?: string;
  disabled?: boolean;
};

/**
 * Reusable copy-to-clipboard affordance.
 * Use anywhere prose, markdown, drafts, or code are shown to the user.
 */
export function CopyButton({
  value,
  label,
  successMessage = "Copied",
  className,
  iconSize = 12,
  variant = "icon",
  title = "Copy to clipboard",
  disabled,
}: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const text = typeof value === "function" ? value() : value;
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Copy failed");
    }
  };

  const Icon = copied ? Check : Copy;

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={cn(
          "inline-flex items-center gap-1 border border-line-200 bg-paper-0 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700 hover:border-ink-950 hover:text-ink-950 disabled:opacity-50",
          className,
        )}
      >
        <Icon size={iconSize} />
        {label ?? (copied ? "Copied" : "Copy")}
      </button>
    );
  }

  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={cn(
          "inline-flex items-center gap-1 text-ink-500 hover:text-ink-950 disabled:opacity-50",
          className,
        )}
      >
        <Icon size={iconSize} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center border border-line-200 bg-paper-0 text-ink-600 hover:border-ink-950 hover:text-ink-950 disabled:opacity-50",
        className,
      )}
    >
      <Icon size={iconSize} />
    </button>
  );
}
