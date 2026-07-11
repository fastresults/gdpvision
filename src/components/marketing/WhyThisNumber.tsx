import { Link } from "@tanstack/react-router";

import { CODEX_ENTRIES } from "@/lib/codex-entries";

interface Props {
  slug: string;
  label?: string;
  className?: string;
}

// PRD FR-SE-09 — "Why this number?" drill-down. Renders a tiny footprint link
// that deep-links the reader to the matching Codex entry.
export function WhyThisNumber({ slug, label = "Why this?", className }: Props) {
  const entry = CODEX_ENTRIES.find((e) => e.id === slug);
  const title = entry ? `${entry.title} — methodology` : "Methodology";
  return (
    <Link
      to="/codex"
      hash={slug}
      title={title}
      className={
        "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950 " +
        (className ?? "")
      }
    >
      <span aria-hidden>ⓘ</span> {label}
    </Link>
  );
}
