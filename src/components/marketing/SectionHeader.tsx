import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, lede, className }: SectionHeaderProps) {
  return (
    <header className={cn("max-w-3xl", className)}>
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        {eyebrow}
      </div>
      <div className="mt-4 h-px w-12 bg-ink-700" aria-hidden />
      <h2 className="mt-6 font-serif text-[34px] md:text-[43px] leading-[1.1] tracking-tight text-ink-950">
        {title}
      </h2>
      {lede ? (
        <p className="mt-5 text-[17px] leading-relaxed text-ink-700 max-w-2xl">{lede}</p>
      ) : null}
    </header>
  );
}
