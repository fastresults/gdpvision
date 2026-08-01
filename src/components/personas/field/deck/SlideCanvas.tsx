// @domain personas
// @ui src/components/personas/field/deck/DeckModal.tsx
//
// Chamber 07 · The slide surface. Every slide is authored at a fixed
// 1920×1080 and scaled to whatever container holds it, so the on-screen
// deck, the thumbnails, the present mode and the printed PDF are the same
// pixels. House style only: paper ground, ink type, one gold accent.

import { useEffect, useRef, useState } from "react";

import type { DeckSlide } from "@/lib/personas/programme-deck.functions";

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

/** Scales a 1920×1080 slide to fit its parent box. */
export function ScaledSlide({
  slide,
  total,
  index,
  className,
}: {
  slide: DeckSlide;
  total: number;
  index: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      setScale(Math.min(r.width / SLIDE_W, r.height / SLIDE_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          marginLeft: -SLIDE_W / 2,
          marginTop: -SLIDE_H / 2,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <SlideBody slide={slide} total={total} index={index} />
      </div>
    </div>
  );
}

/** The slide itself, at true 1920×1080. Used by the viewer and by print. */
export function SlideBody({
  slide,
  total,
  index,
}: {
  slide: DeckSlide;
  total: number;
  index: number;
}) {
  const dark = slide.kind === "cover" || slide.kind === "closing";
  return (
    <div
      className={`relative flex h-full w-full flex-col ${
        dark ? "bg-ink-950 text-paper-0" : "bg-paper-0 text-ink-950"
      }`}
      style={{ width: SLIDE_W, height: SLIDE_H, padding: "104px 128px" }}
    >
      {/* eyebrow */}
      <p
        className={`font-mono uppercase ${dark ? "text-paper-0/60" : "text-ink-500"}`}
        style={{ fontSize: 22, letterSpacing: "0.24em" }}
      >
        {slide.eyebrow}
      </p>

      {/* heading */}
      <h2
        className="font-serif"
        style={{
          marginTop: dark ? 40 : 24,
          fontSize: dark ? 104 : 76,
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          maxWidth: dark ? 1400 : 1300,
        }}
      >
        {slide.heading}
      </h2>

      {slide.subheading && (
        <p
          className={dark ? "text-paper-0/75" : "text-ink-700"}
          style={{ marginTop: 28, fontSize: 38, lineHeight: 1.25, maxWidth: 1200 }}
        >
          {slide.subheading}
        </p>
      )}

      {/* body */}
      <div className="mt-auto flex w-full items-end justify-between" style={{ gap: 96 }}>
        <div style={{ maxWidth: slide.rows?.length ? 900 : 1300, width: "100%" }}>
          {slide.bullets && slide.bullets.length > 0 && (
            <ul style={{ marginBottom: slide.stats?.length ? 56 : 0 }}>
              {slide.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex"
                  style={{ gap: 28, marginBottom: 26, alignItems: "baseline" }}
                >
                  <span
                    className="font-mono text-gold-500"
                    style={{ fontSize: 22, letterSpacing: "0.1em" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={dark ? "text-paper-0/90" : "text-ink-800"}
                    style={{ fontSize: 34, lineHeight: 1.28 }}
                  >
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {slide.stats && slide.stats.length > 0 && (
            <div className="flex" style={{ gap: 88 }}>
              {slide.stats.map((s) => (
                <div key={s.label}>
                  <p
                    className={`font-mono uppercase ${dark ? "text-paper-0/60" : "text-ink-500"}`}
                    style={{ fontSize: 20, letterSpacing: "0.2em" }}
                  >
                    {s.label}
                  </p>
                  <p
                    className="font-serif tabular-nums"
                    style={{ fontSize: 72, lineHeight: 1.05, marginTop: 8 }}
                  >
                    {s.value}
                  </p>
                  {s.note && (
                    <p
                      className={dark ? "text-paper-0/60" : "text-ink-500"}
                      style={{ fontSize: 22, marginTop: 6 }}
                    >
                      {s.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {slide.rows && slide.rows.length > 0 && (
          <div style={{ width: 760 }}>
            {slide.rows.map((r, i) => (
              <div
                key={`${r.left}-${i}`}
                className="flex items-baseline border-t"
                style={{
                  gap: 28,
                  paddingTop: 16,
                  paddingBottom: 16,
                  borderColor: dark ? "rgba(255,255,255,0.18)" : "var(--color-line-200)",
                }}
              >
                <span className="font-mono text-gold-500" style={{ fontSize: 22 }}>
                  {r.left}
                </span>
                <span
                  className={dark ? "text-paper-0/85" : "text-ink-800"}
                  style={{ fontSize: 28, lineHeight: 1.3 }}
                >
                  {r.right}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* footer rule */}
      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: `1px solid ${dark ? "rgba(255,255,255,0.2)" : "var(--color-line-200)"}`,
        }}
      >
        <p
          className={`font-mono uppercase ${dark ? "text-paper-0/55" : "text-ink-500"}`}
          style={{ fontSize: 20, letterSpacing: "0.2em" }}
        >
          {slide.note ?? "GDPVision · Chamber 07"}
        </p>
        <p
          className={`font-mono tabular-nums ${dark ? "text-paper-0/55" : "text-ink-500"}`}
          style={{ fontSize: 20, letterSpacing: "0.2em" }}
        >
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}
