import { cn } from "@/lib/utils";

/**
 * GLOBAL ILLUSTRATION CONTRACT — see docs/illustration-contract.md
 *
 * Every illustration in front-facing UI/UX and in exported documents renders
 * through this component. It enforces the house style: hand-drawn engraved
 * graphite sketch, monochrome, on the paper ground. No section may place a
 * bare <img> for an illustration.
 *
 * The only exception to the contract is the website hero section, which keeps
 * its existing treatment.
 */

type IllustrationVariant = "spot" | "band" | "panel";

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
  // Wide rule-like band that sits between a section header and its content.
  band: "w-full aspect-[3/1]",
  // Small centred mark beside a column of text.
  spot: "w-full max-w-[220px] aspect-square",
  // Larger supporting panel.
  panel: "w-full aspect-[4/3]",
};

export function Illustration({ src, alt, variant = "band", className }: IllustrationProps) {
  const decorative = !alt;
  return (
    <div
      className={cn("overflow-hidden", VARIANTS[variant], className)}
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
          "grayscale contrast-[1.08] mix-blend-darken",
        )}
      />
    </div>
  );
}
