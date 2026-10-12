import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { CHAMBERS, type Chamber } from "@/lib/chambers";
import { GDP_EVENTS, type GdpEvent } from "@/lib/present/events";
import { DEMO_COUNTRY, chamberDemo } from "@/lib/present/chambers";
import { Wordmark } from "@/components/marketing/Wordmark";
import sealAsset from "@/assets/favicon-seal.png.asset.json";
import { SecondBrainFeed } from "./SecondBrainFeed";
import { ChamberCircuit } from "./ChamberCircuit";
import { LiveFrame } from "./LiveFrame";
import { ChamberGlyph } from "./ChamberGlyph";
import { cn } from "@/lib/utils";

/**
 * The live briefing at /present: a full-viewport, scroll-snapped walk through
 * GDPVision for a room. Arrow keys and space move between steps. Every step
 * reveals when it scrolls into view (`.prs-*` keyframes in src/styles.css).
 */

const MICRO = "font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500";
const H2 =
  "font-display text-[clamp(2.4rem,5vw,4.6rem)] leading-[1.02] tracking-[-0.01em] text-ink-950";
const LEDE = "text-[clamp(1.1rem,1.6vw,1.45rem)] leading-[1.5] text-ink-700";

function useInView<T extends HTMLElement>(threshold = 0.45) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && (setOn(true), io.disconnect()),
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on] as const;
}

interface StepProps {
  id: string;
  label: string;
  tone?: "paper" | "tint";
  children: ReactNode;
  className?: string;
}

function Step({ id, tone = "paper", children, className }: StepProps) {
  const [ref, on] = useInView<HTMLElement>(0.4);
  return (
    <section
      id={id}
      ref={ref}
      data-step
      className={cn(
        "prs-step relative flex min-h-dvh snap-start flex-col justify-center border-b border-line-200 px-6 py-20 md:px-16 lg:px-24",
        tone === "tint" && "bg-paper-100/50",
        on && "is-on",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute left-6 top-20 bottom-20 w-[2px] bg-ink-950 md:left-10"
        aria-hidden
      />
      <div className="mx-auto w-full max-w-[1400px]">{children}</div>
    </section>
  );
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn("prs-rise", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const LADDER = [
  { n: 6, label: "Real-time measurement", note: "developed economies" },
  { n: 5, label: "Quarterly target, regional pooling", note: "" },
  { n: 4, label: "Consistent monthly indicators", note: "GDPVision" },
  { n: 3, label: "Canonized framework", note: "GDPVision" },
  { n: 2, label: "Structured national record", note: "GDPVision" },
  { n: 1, label: "Unstructured", note: "most OECS states today" },
];

const ECCU = [
  "Antigua & Barbuda",
  "Dominica",
  "Grenada",
  "St. Kitts & Nevis",
  "Saint Lucia",
  "St. Vincent & the Grenadines",
  "Anguilla",
  "Montserrat",
];

function EventStep({ ev, index }: { ev: GdpEvent; index: number }) {
  const [ref, on] = useInView<HTMLElement>(0.4);
  const [wide, setWide] = useState(false);
  const host = ev.url ? ev.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;

  return (
    <section
      id={`event-${ev.id}`}
      ref={ref}
      data-step
      className={cn(
        "prs-step relative flex min-h-dvh snap-start flex-col justify-center border-b border-line-200 px-6 py-16 md:px-16 lg:px-0 lg:pt-[57px] lg:pb-2",
        on && "is-on",
      )}
    >
      <div
        className="pointer-events-none absolute left-6 top-16 bottom-16 w-[2px] bg-ink-950 md:left-10"
        aria-hidden
      />
      <div
        className={cn(
          "grid w-full min-w-0 items-center gap-10 lg:gap-0",
          wide ? "grid-cols-1" : "lg:grid-cols-2",
        )}
      >
        <div className={cn("prs-rise lg:pl-24 lg:pr-10", wide && "hidden")}>
          <div className={MICRO}>
            Event {String(index + 1).padStart(2, "0")} · {ev.dates}
            {ev.apex ? " · The apex" : ""}
          </div>
          <h2 className={cn(H2, "mt-4")}>{ev.code}</h2>
          <p className="mt-3 text-[clamp(1.3rem,2vw,1.8rem)] leading-tight text-ink-900">
            {ev.name}
          </p>
          <p className="mt-5 font-display text-[clamp(1.2rem,1.8vw,1.6rem)] italic leading-snug text-ink-700">
            “{ev.theme}”
          </p>
          <hr className="my-6 border-line-200" />
          <p className={LEDE}>{ev.purpose}</p>
          <div className={cn(MICRO, "mt-5")}>
            {ev.venue} · Sector: {ev.sector}
          </div>
          {ev.url ? (
            <div className="mt-8">
              <a href={ev.url} target="_blank" rel="noreferrer" className="btn-primary">
                Open {host}
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>

        <div className="prs-rise min-w-0 w-full" style={{ animationDelay: "200ms" }}>
          {ev.url && host ? (
            <LiveFrame
              src={ev.url}
              label={host}
              title={`${ev.name} website`}
              wide={wide}
              onWide={() => setWide(true)}
              onNarrow={() => setWide(false)}
            />
          ) : (
            <div className="flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-dashed border-line-200 bg-paper-100/60">
              <div className="text-center">
                <div className="font-display text-3xl text-ink-700">{ev.code}</div>
                <div className={cn(MICRO, "mt-3")}>Site coming online</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ChamberStep({ c }: { c: Chamber }) {
  const demo = chamberDemo(c.index);
  const [ref, on] = useInView<HTMLElement>(0.4);
  const [wide, setWide] = useState(false);
  if (!demo) return null;
  const label = `gdpvision.com${demo.path}`;

  return (
    <section
      id={`chamber-${c.index}`}
      ref={ref}
      data-step
      className={cn(
        "prs-step relative flex min-h-dvh snap-start flex-col justify-center border-b border-line-200 px-6 py-16 md:px-16 lg:px-0 lg:pt-[57px] lg:pb-2",
        on && "is-on",
      )}
    >
      <div
        className="pointer-events-none absolute left-6 top-16 bottom-16 w-[2px] bg-ink-950 md:left-10"
        aria-hidden
      />
      <div
        className={cn(
          "grid w-full min-w-0 items-center gap-10 lg:gap-0",
          wide ? "grid-cols-1" : "lg:grid-cols-2",
        )}
      >
        <div className={cn("lg:pl-24 lg:pr-10", wide && "hidden")}>
          <Reveal>
            <div className="flex items-center gap-3">
              <ChamberGlyph index={c.index} accentVar={c.accentVar} size={36} />
              <div className={MICRO} style={{ color: `var(${c.accentVar})` }}>
                Chamber {c.index} of 10
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className={cn(H2, "mt-3 text-[clamp(2rem,3.6vw,3.4rem)]")}>{c.title}</h2>
          </Reveal>
          <Reveal delay={220}>
            <p className="mt-3 font-display text-[clamp(1.2rem,1.7vw,1.5rem)] italic leading-snug text-ink-700">
              {c.outcome}
            </p>
          </Reveal>
          <Reveal delay={340}>
            <p className={cn(LEDE, "mt-4 text-[clamp(1rem,1.2vw,1.15rem)]")}>{c.purpose}</p>
          </Reveal>
          <div className="mt-6 border-t border-line-200 pt-4">
            <ChamberCircuit demo={demo} accentVar={c.accentVar} />
          </div>
        </div>

        <div className="prs-rise min-w-0 w-full" style={{ animationDelay: "200ms" }}>
          <LiveFrame
            src={demo.path}
            label={label}
            title={`${c.title}, live for ${DEMO_COUNTRY}`}
            wide={wide}
            onWide={() => setWide(true)}
            onNarrow={() => setWide(false)}
          />
        </div>
      </div>
    </section>
  );
}

export function PresentDeck() {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  // Where a smooth scroll is heading. Lets two quick arrow presses count as two
  // steps instead of one, since the observer only reports once the scroll lands.
  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    const steps = Array.from(document.querySelectorAll<HTMLElement>("[data-step]"));
    setStepCount(steps.length);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = steps.indexOf(e.target as HTMLElement);
          setStepIndex(i);
          if (targetRef.current === i) targetRef.current = null;
        });
      },
      { threshold: 0.55 },
    );
    steps.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      const steps = Array.from(document.querySelectorAll<HTMLElement>("[data-step]"));
      const from = targetRef.current ?? stepIndex;
      const next = Math.min(steps.length - 1, Math.max(0, from + dir));
      targetRef.current = next;
      steps[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [stepIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "IFRAME"))
        return;
      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === " " ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className="prs-deck bg-paper-0 font-sans text-ink-950 antialiased">
      {/* Fixed chrome */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line-200 bg-paper-0/90 px-5 py-3 backdrop-blur md:px-10">
        <Link to="/" className="flex items-center gap-3">
          <Wordmark className="h-6" />
          <span className={MICRO}>Briefing</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className={cn(MICRO, "tabular-nums")}>
            {String(stepIndex + 1).padStart(2, "0")} / {String(stepCount).padStart(2, "0")}
          </span>
          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => go(-1)}
              aria-label="Previous step"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => go(1)}
              aria-label="Next step"
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>
      <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-line-200" aria-hidden>
        <div
          className="h-full bg-ink-950 transition-[width] duration-500"
          style={{ width: `${stepCount ? ((stepIndex + 1) / stepCount) * 100 : 0}%` }}
        />
      </div>

      <main className="snap-y snap-proximity">
        {/* 01 Cover */}
        <Step id="cover" label="Cover" className="pt-28">
          <Reveal className="mb-12 flex justify-center">
            <img
              src={sealAsset.url}
              alt="GDPVision seal: Instrument of State"
              width={1319}
              height={1341}
              className="h-auto w-[clamp(160px,22vh,260px)]"
              decoding="async"
            />
          </Reveal>
          <Reveal delay={120}>
            <div className={MICRO}>Briefing · October 2026</div>
          </Reveal>
          <Reveal delay={220}>
            <h1 className="mt-6 font-display text-[clamp(3.6rem,9vw,9rem)] leading-[0.95] tracking-[-0.02em] text-ink-950">
              GDPVision
            </h1>
          </Reveal>
          <Reveal delay={260}>
            <p className={cn(LEDE, "mt-8 max-w-3xl text-[clamp(1.3rem,2vw,1.9rem)]")}>
              A decision system for governments that don't have the floor yet.
            </p>
          </Reveal>
          <Reveal delay={400}>
            <div className={cn(MICRO, "mt-10 leading-7")}>
              Adam Anderson · OPEN Interactive · adam@madebyopen.com
              <br />
              Use the arrow keys or space to move through the briefing.
            </div>
          </Reveal>
        </Step>

        {/* 02 What */}
        <Step id="what" label="What it is">
          <Reveal>
            <div className={MICRO}>01 · What it is</div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className={cn(H2, "mt-5 max-w-5xl")}>
              One trusted picture of the country. A way to rehearse a decision. A record of what was
              decided.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              [
                "See",
                "Every number a Cabinet relies on, with where it came from, how it was made, how much to trust it, and how old it is.",
              ],
              [
                "Rehearse",
                "Compare credible choices before committing, in a space the government owns and controls.",
              ],
              [
                "Deliver",
                "Turn the chosen course into owned commitments, and keep the record through delivery and across elections.",
              ],
            ].map(([h, b], i) => (
              <Reveal key={h} delay={300 + i * 140}>
                <div className="border-t-2 border-ink-950 pt-6">
                  <div className="font-display text-3xl text-ink-950">{h}</div>
                  <p className={cn(LEDE, "mt-3")}>{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Step>

        {/* 03 Why */}
        <Step id="why" label="Why we built it" tone="tint">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div>
              <Reveal>
                <div className={MICRO}>02 · Why we built it</div>
              </Reveal>
              <Reveal delay={100}>
                <h2 className={cn(H2, "mt-5")}>
                  Start where developing nations are. <i>Build the floor.</i>
                </h2>
              </Reveal>
              <Reveal delay={260}>
                <p className={cn(LEDE, "mt-8")}>
                  Developed countries can measure their economies in real time because they spent
                  ninety years building what sits underneath: national accounts, monthly surveys, a
                  legal duty to report, small revisions.
                </p>
              </Reveal>
              <Reveal delay={380}>
                <p className={cn(LEDE, "mt-5")}>
                  Most developing countries have none of that. Output comes out once a year, a year
                  late. There's no deliberate framework and no decision tool. That's where GDPVision
                  starts.
                </p>
              </Reveal>
              <Reveal delay={500}>
                <p className={cn(LEDE, "mt-5 text-ink-500")}>
                  Real-time measurement is the long-term aspiration. The floor comes first.
                </p>
              </Reveal>
            </div>
            <div className="flex flex-col gap-3">
              {LADDER.map((r, i) => {
                const mine = r.n >= 2 && r.n <= 4;
                return (
                  <Reveal key={r.n} delay={900 - i * 120} className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex-1 rounded-lg border px-5 py-4 text-lg",
                        mine
                          ? "border-ink-950 bg-paper-0 text-ink-950"
                          : "border-line-200 text-ink-500",
                      )}
                      style={mine ? { borderWidth: 2 } : undefined}
                    >
                      {r.n} · {r.label}
                    </div>
                    <span className={cn(MICRO, "w-40", mine && "text-ink-950")}>{r.note}</span>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </Step>

        {/* 04 Where */}
        <Step id="where" label="Where it starts">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <Reveal>
                <div className={MICRO}>03 · Where it starts</div>
              </Reveal>
              <Reveal delay={100}>
                <h2 className={cn(H2, "mt-5")}>Beginning in the OECS and CARICOM.</h2>
              </Reveal>
              <Reveal delay={260}>
                <p className={cn(LEDE, "mt-8")}>
                  OPEN Interactive has been headquartered in St. Kitts &amp; Nevis since 2014 and
                  has worked with Caribbean governments on sector-by-sector GDP development for
                  twelve years. The region is the natural pilot.
                </p>
              </Reveal>
              <Reveal delay={380}>
                <p className={cn(LEDE, "mt-5")}>
                  Antigua &amp; Barbuda is the demonstration country today. Each nation gets its own
                  isolated, government-owned instance.
                </p>
              </Reveal>
              <Reveal delay={500}>
                <p className={cn(LEDE, "mt-5 text-ink-500")}>
                  The same ladder applies to developing countries everywhere. East Africa is the
                  next conversation.
                </p>
              </Reveal>
            </div>
            <div>
              <Reveal delay={300}>
                <div className={MICRO}>Eastern Caribbean Currency Union</div>
              </Reveal>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {ECCU.map((n, i) => (
                  <Reveal key={n} delay={400 + i * 70}>
                    <div className="rounded-lg border border-line-200 px-4 py-3 text-ink-900">
                      {n}
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={1100}>
                <div className={cn(MICRO, "mt-5")}>
                  One currency · one central bank · annual GDP only
                </div>
              </Reveal>
            </div>
          </div>
        </Step>

        {/* 05 Corpus: the Second Brain, fed */}
        <Step id="corpus" label="The corpus" tone="tint">
          <Reveal>
            <div className={MICRO}>04 · The corpus · the Second Brain</div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className={cn(H2, "mt-4 text-[clamp(2rem,4vw,3.6rem)]")}>
              How the Second Brain is fed.
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className={cn(LEDE, "mt-4 max-w-4xl text-[clamp(1rem,1.3vw,1.2rem)]")}>
              Public measuring bodies stream in from the left. Private national data sits behind the
              sovereign wall on the right, on hardware the government holds, and never leaves. Only
              findings approved by two named officials cross into the brain. Every figure inside
              carries its source, method, grade and date.
            </p>
          </Reveal>
          <div className="mx-auto mt-4 max-w-[1000px]">
            <SecondBrainFeed />
          </div>
        </Step>

        {/* 06 Chambers overview */}
        <Step id="chambers" label="The chambers">
          <Reveal>
            <div className={MICRO}>05 · The chambers</div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className={cn(H2, "mt-5")}>Ten chambers. One record.</h2>
          </Reveal>
          <Reveal delay={240}>
            <p className={cn(LEDE, "mt-5 max-w-4xl")}>
              Each chamber is a workspace for one job a government has to do. They all read from,
              and write to, the same national record. The next ten steps open each one live, for{" "}
              {DEMO_COUNTRY === "ATG" ? "Antigua & Barbuda" : DEMO_COUNTRY}.
            </p>
          </Reveal>
          <div className="mt-12 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {CHAMBERS.map((c, i) => (
              <Reveal key={c.index} delay={400 + i * 110}>
                <a
                  href={`#chamber-${c.index}`}
                  className="block h-full rounded-lg border border-line-200 bg-paper-0 p-5 transition-colors hover:border-ink-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-mono text-sm" style={{ color: `var(${c.accentVar})` }}>
                      {c.index}
                    </div>
                    <ChamberGlyph index={c.index} accentVar={c.accentVar} size={52} />
                  </div>
                  <div className="mt-4 text-lg leading-snug text-ink-950">
                    {c.title.replace(/^The /, "")}
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </Step>

        {/* 07–16 Chamber walk: circuit on the left, the live chamber on the right */}
        {CHAMBERS.map((c) => (
          <ChamberStep key={c.index} c={c} />
        ))}

        {/* 17 Events overview */}
        <Step id="events" label="The GDP events" tone="tint">
          <Reveal>
            <div className={MICRO}>06 · The GDP events</div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className={cn(H2, "mt-5")}>One summit per sector. The room the framework gets.</h2>
          </Reveal>
          <Reveal delay={240}>
            <p className={cn(LEDE, "mt-5 max-w-4xl")}>
              The summit series maps one-to-one onto the GDP sectors. Each event is where a sector's
              ministers, investors and operators meet, and where the sector's work in GDPVision gets
              put in front of people. It starts with the GDP Summit.
            </p>
          </Reveal>
          <div className="mt-10 divide-y divide-line-200 border-y border-line-200">
            {GDP_EVENTS.map((ev, i) => (
              <Reveal key={ev.id} delay={400 + i * 80}>
                <a
                  href={`#event-${ev.id}`}
                  className="grid gap-2 py-4 transition-colors hover:bg-paper-0 md:grid-cols-[180px_140px_1fr_260px] md:items-baseline"
                >
                  <span className={cn(MICRO, "text-ink-700")}>{ev.dates}</span>
                  <span className="font-mono text-sm text-ink-950">
                    {ev.code}
                    {ev.apex ? " ·" : ""}
                  </span>
                  <span className="text-lg text-ink-900">{ev.name}</span>
                  <span className={MICRO}>{ev.venue}</span>
                </a>
              </Reveal>
            ))}
          </div>
        </Step>

        {/* 18–27 Event tour */}
        {GDP_EVENTS.map((ev, i) => (
          <EventStep key={ev.id} ev={ev} index={i} />
        ))}

        {/* 28 Conclusion */}
        <Step id="conclusion" label="How it fits together" tone="tint">
          <Reveal>
            <div className={MICRO}>07 · How it fits together</div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className={cn(H2, "mt-5 max-w-5xl")}>
              The corpus feeds the chambers. The chambers feed the events. The events build the
              floor.
            </h2>
          </Reveal>
          <div className="mt-14 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {[
              ["The corpus", "Every number, with source, method, grade and date"],
              ["Ten chambers", "See it, rehearse it, decide it, deliver it"],
              ["Ten events", "One room per sector, every year"],
              ["The floor", "A structured, consistent record a parliament can write into law"],
            ].map(([h, b], i) => (
              <Fragment key={h}>
                {i > 0 ? (
                  <Reveal delay={500 + i * 400} className="hidden items-center md:flex">
                    <svg width="56" height="24" viewBox="0 0 56 24" aria-hidden>
                      <path
                        d="M0 12H48M40 4l8 8-8 8"
                        fill="none"
                        stroke="var(--ink-950)"
                        strokeWidth="2"
                      />
                    </svg>
                  </Reveal>
                ) : null}
                <Reveal delay={300 + i * 400}>
                  <div
                    className={cn(
                      "h-full rounded-xl border-2 border-ink-950 bg-paper-0 p-6",
                      i === 3 && "bg-paper-100",
                    )}
                  >
                    <div className={cn(MICRO, "text-ink-950")}>{h}</div>
                    <p className="mt-3 text-lg leading-snug text-ink-900">{b}</p>
                  </div>
                </Reveal>
              </Fragment>
            ))}
          </div>
          <Reveal delay={2000}>
            <p className={cn(LEDE, "mt-12 max-w-4xl")}>
              Piloted in the OECS and CARICOM because that's where we live and have worked for
              twelve years. Built for any developing country that's starting without a floor.
              Real-time measurement is the long-term aspiration. The floor comes first.
            </p>
          </Reveal>
        </Step>

        {/* 29 Close */}
        <Step id="close" label="Close">
          <Reveal>
            <div className={MICRO}>GDPVision</div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="mt-6 font-display text-[clamp(3rem,7vw,7rem)] leading-[0.98] tracking-[-0.02em] text-ink-950">
              Build the floor first. <i>Then measure.</i>
            </h2>
          </Reveal>
          <Reveal delay={320}>
            <div className={cn(MICRO, "mt-10 leading-7")}>
              Adam Anderson · adam@madebyopen.com · OPEN Interactive, St. Kitts &amp; Nevis · EVOVE
              LLC, Atlanta
              <br />
              gdpvision.com
            </div>
          </Reveal>
          <Reveal delay={480}>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/" className="btn-secondary">
                Back to gdpvision.com
              </Link>
              <a href="#cover" className="btn-ghost">
                Start again
              </a>
            </div>
          </Reveal>
        </Step>
      </main>
    </div>
  );
}
