// Investor deck: 16:9 slide frames that scale with their width on screen and
// print one per landscape page. Type is sized in container units so a slide
// reads the same at any width.

import type { CSSProperties, ReactNode } from "react";

import ledgerArt from "@/assets/illustrations/bc-ledger-cost.jpg.asset.json";
import { Illustration } from "@/components/marketing/Illustration";
import type { DeckContent } from "@/lib/investments/package-schema";

import { formatDate, hostOf } from "./parts";

const FRAME: CSSProperties = { containerType: "inline-size" };

function Frame({
  children,
  n,
  total,
  c,
}: {
  children: ReactNode;
  n: number;
  total: number;
  c: DeckContent;
}) {
  return (
    <section
      className="pkg-slide relative mx-auto aspect-[16/9] w-full max-w-[1280px] overflow-hidden border border-line-200 bg-paper-0"
      style={FRAME}
      aria-label={`Slide ${n} of ${total}`}
    >
      <div
        className="absolute inset-x-[5cqw] top-[3.4cqw] border-t-2 border-gold-500"
        aria-hidden
      />
      <div className="absolute inset-x-[5cqw] top-[5cqw] bottom-[6.5cqw] flex flex-col">
        {children}
      </div>
      <div className="absolute inset-x-[5cqw] bottom-[2.8cqw] flex items-baseline justify-between border-t border-line-200 pt-[0.9cqw] font-mono text-[0.95cqw] uppercase tracking-[0.18em] text-ink-500">
        <span className="truncate pr-4">
          {c.project_title} · {c.country_name}
        </span>
        <span data-numeric>
          {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
    </section>
  );
}

export function DeckLayout({ c }: { c: DeckContent }) {
  const total = c.slides.length + 1;
  return (
    <div className="pkg-deck space-y-6 print:space-y-0">
      {c.slides.map((s, i) => {
        const n = i + 1;
        if (i === 0) {
          return (
            <Frame key={i} n={n} total={total} c={c}>
              <div className="flex h-full items-end justify-between gap-[3cqw]">
                <div className="min-w-0 max-w-[62cqw] pb-[2cqw]">
                  <div className="font-mono text-[1.1cqw] uppercase tracking-[0.22em] text-ink-500">
                    {s.kicker || `Investment opportunity · ${c.country_name}`}
                  </div>
                  <h1 className="mt-[1.6cqw] font-display text-[4.6cqw] leading-[1.05] tracking-tight text-ink-950">
                    {s.title}
                  </h1>
                  {/* The slide's single red accent. */}
                  <div aria-hidden className="mt-[2cqw] w-[6cqw] border-t border-narrative-500" />
                  {s.bullets.length > 0 ? (
                    <ul className="mt-[2cqw] space-y-[0.6cqw] text-[1.7cqw] leading-snug text-ink-700">
                      {s.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-[2.4cqw] font-mono text-[1cqw] uppercase tracking-[0.16em] text-ink-500">
                    {c.country_name} · Prepared {formatDate(c.prepared_on)}
                  </div>
                </div>
                {s.visual === "illustration" ? (
                  <Illustration
                    src={ledgerArt.url}
                    variant="mark"
                    className="!w-[9.5cqw] shrink-0 pb-[2cqw]"
                  />
                ) : null}
              </div>
            </Frame>
          );
        }
        const showFigures = s.figures.length > 0 && s.visual !== "illustration";
        return (
          <Frame key={i} n={n} total={total} c={c}>
            <div className="font-mono text-[1.1cqw] uppercase tracking-[0.22em] text-ink-500">
              {s.kicker}
            </div>
            <h2 className="mt-[1.1cqw] max-w-[70cqw] font-display text-[3.4cqw] leading-[1.08] tracking-tight text-ink-950">
              {s.title}
            </h2>
            <div
              className={
                showFigures
                  ? "mt-[3cqw] grid flex-1 grid-cols-[1.25fr_1fr] gap-[4cqw]"
                  : "mt-[3cqw] flex-1"
              }
            >
              <ul className="space-y-[1.3cqw]">
                {s.bullets.map((b, j) => (
                  <li
                    key={j}
                    className="grid grid-cols-[2.4cqw_1fr] text-[1.85cqw] leading-snug text-ink-950"
                  >
                    <span className="pt-[0.35cqw] font-mono text-[1cqw] text-gold-500">
                      {String(j + 1).padStart(2, "0")}
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {showFigures ? (
                <div className="grid content-start gap-[2.2cqw] border-l border-line-200 pl-[3cqw]">
                  {s.figures.map((f) => {
                    const host = hostOf(f.source_url);
                    return (
                      <div key={f.key}>
                        <div
                          data-numeric
                          className="font-display text-[3.6cqw] leading-none tracking-tight text-ink-950"
                        >
                          {f.display}
                        </div>
                        <div className="mt-[0.7cqw] font-mono text-[0.95cqw] uppercase tracking-[0.16em] text-ink-500">
                          {f.label}
                          {f.period ? ` · ${f.period}` : ""}
                          {host ? ` · ${host}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </Frame>
        );
      })}
      <Frame n={total} total={total} c={c}>
        <div className="font-mono text-[1.1cqw] uppercase tracking-[0.22em] text-ink-500">
          Important notice
        </div>
        <p className="mt-[2cqw] max-w-[78cqw] text-[1.35cqw] leading-relaxed text-ink-700">
          {c.disclaimer}
        </p>
      </Frame>
    </div>
  );
}
