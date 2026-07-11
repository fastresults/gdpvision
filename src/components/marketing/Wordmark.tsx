import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  as?: "span" | "div" | "h1";
}

// GDPVISION — display serif, letterspaced, always ink (never gold). PRD §10.3.
export function Wordmark({ className, as: Tag = "span" }: WordmarkProps) {
  return (
    <Tag
      className={cn(
        "font-serif text-ink-950 uppercase",
        "tracking-[0.18em] leading-none",
        className,
      )}
      aria-label="GDPVision"
    >
      GDPVision
    </Tag>
  );
}
