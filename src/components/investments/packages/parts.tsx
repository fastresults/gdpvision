// Shared pieces of the investor-package document style: mono kickers, serif
// key figures, hairline tables. Pure presentation — no data fetching.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { PackageFigure, PackageTable } from "@/lib/investments/package-schema";

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500", className)}
    >
      {children}
    </div>
  );
}

/** The thin gold rule that opens every page. */
export function GoldRule({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-0 border-t-2 border-gold-500", className)} />;
}

/** A large serif numeral over a mono caption. */
export function KeyFigure({ figure, size = "md" }: { figure: PackageFigure; size?: "md" | "lg" }) {
  const host = hostOf(figure.source_url);
  return (
    <div className="min-w-0">
      <div
        data-numeric
        className={cn(
          "font-display leading-none tracking-tight text-ink-950",
          size === "lg" ? "text-[34px] print:text-[26pt]" : "text-[26px] print:text-[20pt]",
        )}
      >
        {figure.display}
      </div>
      <div className="mt-2 font-mono text-[9.5px] uppercase leading-snug tracking-[0.16em] text-ink-500">
        {figure.label}
        {figure.period ? ` · ${figure.period}` : ""}
      </div>
      {host ? (
        <div className="mt-0.5 font-mono text-[9px] tracking-[0.04em] text-ink-400">
          Source: {host}
        </div>
      ) : null}
    </div>
  );
}

/** Hairline table. Header row is typography only — never a filled band. */
export function HairlineTable({ table, className }: { table: PackageTable; className?: string }) {
  return (
    <figure className={cn("my-0", className)}>
      <table className="w-full border-collapse text-left text-[12.5px] leading-snug text-ink-950 print:text-[9pt]">
        <thead>
          <tr className="border-b border-ink-950/60">
            {table.columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="py-1.5 pr-4 align-bottom font-mono text-[9.5px] font-normal uppercase tracking-[0.16em] text-ink-500 last:pr-0"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-line-200 align-top">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn("py-1.5 pr-4 last:pr-0", j === 0 ? "text-ink-950" : "text-ink-700")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.caption ? (
        <figcaption className="mt-2 font-mono text-[9.5px] tracking-[0.04em] text-ink-500">
          {table.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** A document sheet: paper, hairline frame on screen, bare in print. */
export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "pkg-sheet mx-auto w-full max-w-[8.5in] border border-line-200 bg-paper-0 px-5 py-8 sm:px-10 md:px-[0.75in] md:py-[0.7in]",
        className,
      )}
    >
      {children}
    </div>
  );
}
