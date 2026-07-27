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

// Width clamps only — the art keeps its own aspect ratio so nothing is boxed,
// letterboxed or cropped. Height follows from the asset.
const VARIANTS: Record<IllustrationVariant, string> = {
  // Tiny inline mark, sits beside an eyebrow, label or wordmark.
  mark: "w-[72px] md:w-[88px]",
  // Small margin-anchored mark beside a column of text.
  spot: "w-[150px] md:w-[190px]",
  // Supporting art that occupies the empty half of an existing 2-col grid.
  aside: "w-full max-w-[300px]",
  // Thin engraved divider under a section header, never full width.
  rule: "w-full max-w-[520px]",
};

export function Illustration({ src, alt, variant = "spot", className }: IllustrationProps) {
  const decorative = !alt;
  return (
    <div
      className={cn("select-none pointer-events-none", VARIANTS[variant], className)}
      aria-hidden={decorative || undefined}
    >
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className={cn(
          "block h-auto w-full object-contain",
          // Contract: monochrome only. Never let a generated asset introduce
          // colour, and let the paper ground show through the white field.
          "grayscale contrast-[1.12] opacity-90 mix-blend-darken",
        )}
      />
    </div>
  );
}

