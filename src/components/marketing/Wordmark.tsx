import { cn } from "@/lib/utils";
import logoAsset from "@/assets/gdpvision-logo.png.asset.json";

interface WordmarkProps {
  className?: string;
  /** Kept for API compatibility with existing call sites. */
  as?: "span" | "div" | "h1";
}

// GDP Vision brand lockup (seal + wordmark). Raster brand asset — sized by height.
export function Wordmark({ className }: WordmarkProps) {
  return (
    <img
      src={logoAsset.url}
      alt="GDP Vision"
      loading="eager"
      decoding="async"
      className={cn("h-9 w-auto max-w-full object-contain select-none", className)}
    />
  );
}
