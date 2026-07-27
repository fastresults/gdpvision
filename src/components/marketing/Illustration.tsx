import { cn } from "@/lib/utils";

/**
 * GLOBAL ILLUSTRATION CONTRACT — see docs/illustration-contract.md
 *
 * Every illustration in front-facing UI/UX and in exported documents renders
 * through this component. It enforces the house style: hand-drawn engraved
 * graphite sketch, monochrome, on the paper ground. No section may place a
 * bare <img> for an illustration.
 *
 * SCALE + PLACEMENT (contract v2). Illustrations are marginalia: they accent
 * the page, they never carry it.
 *   - one illustration maximum per section
 *   - never full-bleed, never inside the reading column
 *   - hard max sizes below; `band` is retired
 *
 * The only exception to the contract is the website hero section, which keeps
 * its existing treatment.
 */

type IllustrationVariant = "mark" | "spot" | "aside" | "rule";

interface IllustrationProps {
  /** CDN url from a `.asset.json` pointer under src/assets/illustrations. */
  src: string;
  /**
   * Leave undefined for decorative illustrations — the component then marks
   * the image aria-hidden with an empty alt. Pass a description only when the
   * illustration carries meaning a screen-reader user would otherwise lose.
   */
  alt?: string;
  variant?: IllustrationVariant;
  className?: string;
}

const VARIANTS: Record<IllustrationVariant, string> = {
  // Tiny inline mark, sits beside an eyebrow or a wordmark.
  mark: "h-9 w-9 md:h-10 md:w-10",
  // Small margin-anchored mark beside a column of text.
  spot: "w-full max-w-[120px] md:max-w-[140px] aspect-square",
  // Supporting art that occupies the empty half of an existing 2-col grid.
  aside: "w-full max-w-[260px] aspect-square",
  // Thin engraved divider under a section header, never full width.
  rule: "w-full max-w-[560px] aspect-[6/1]",
};

export function Illustration({ src, alt, variant = "spot", className }: IllustrationProps) {
  const decorative = !alt;
  return (
    <div
      className={cn(
        "overflow-hidden select-none pointer-events-none",
        VARIANTS[variant],
        className,
      )}
      aria-hidden={decorative || undefined}
    >
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className={cn(
          "h-full w-full object-contain",
          // Contract: monochrome only. Never let a generated asset introduce
          // colour, and let the paper ground show through the white field.
          "grayscale contrast-[1.08] opacity-[0.85] mix-blend-darken",
        )}
      />
    </div>
  );
}
