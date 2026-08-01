// Sovereign switchboard: Chamber 01 gets a hero row; 02–08 fill the grid.
// Numeric monogram is the visual anchor; icon is a small mark, not a headline.

import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Landmark,
  Layers,
  MessageSquare,
  ScrollText,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

type Chamber = {
  n: string;
  icon: LucideIcon;
  title: string;
  blurb: string;
  to:
    | "/admin/countries/$code/ledger"
    | "/admin/countries/$code/portfolio"
    | "/admin/countries/$code/scenarios"
    | "/admin/countries/$code/studio"
    | "/admin/countries/$code/narrative"
    | "/admin/countries/$code/cabinet"
    | "/admin/countries/$code/personas"
    | "/admin/countries/$code/mandate-compact";
};

const HERO: Chamber = {
  n: "01",
  icon: BookOpen,
  title: "The National Ledger",
  blurb: "Authoritative decomposition of the national economy — sector by sector, source by source.",
  to: "/admin/countries/$code/ledger",
};

const REST: Chamber[] = [
  { n: "02", icon: Layers, title: "Portfolio Workspaces", blurb: "One workspace per ministerial portfolio.", to: "/admin/countries/$code/portfolio" },
  { n: "03", icon: Activity, title: "The Scenario Engine", blurb: "Consequence-free rehearsal across every downstream metric.", to: "/admin/countries/$code/scenarios" },
  { n: "04", icon: TrendingUp, title: "The FDI Transition Studio", blurb: "Threat in, resilient FDI strategy out — sector by sector.", to: "/admin/countries/$code/studio" },
  { n: "05", icon: MessageSquare, title: "The Narrative Chamber", blurb: "Signal to statement inside a working day.", to: "/admin/countries/$code/narrative" },
  { n: "06", icon: Landmark, title: "The Cabinet Room", blurb: "Prep, run, and follow through on cabinet business.", to: "/admin/countries/$code/cabinet" },
  { n: "07", icon: Users, title: "The Research Chamber", blurb: "Rehearse with a synthetic public, or field the real one.", to: "/admin/countries/$code/personas" },
  { n: "08", icon: ScrollText, title: "The Mandate Compact", blurb: "Manifesto to delivery — pledges tracked to the ministry.", to: "/admin/countries/$code/mandate-compact" },
];


export function ChambersLauncher({ code }: { code: string }) {
  return (
    <section className="space-y-5">
      {/* The roof over the eight chambers. */}
      <Link
        to="/admin/countries/$code/executive"
        params={{ code }}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-ink-950 bg-card px-6 py-4 transition hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
      >
        <span className="min-w-0">
          <span className="block font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
            For the Principal
          </span>
          <span className="mt-1 block truncate font-serif text-[22px] text-ink-950">
            The Executive Brief
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-ink-500">
            What requires a decision today, and the standing of all eight chambers on one screen.
          </span>
        </span>
        <ArrowUpRight
          size={18}
          strokeWidth={1.5}
          className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-950"
        />
      </Link>

      <div className="flex items-baseline justify-between">

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
            The switchboard
          </p>
          <h2 className="mt-2 font-serif text-3xl text-ink-950">Enter a chamber</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Eight sovereign chambers · one country
        </span>
      </div>

      {/* Hero chamber (01) */}
      <HeroTile code={code} chamber={HERO} />

      {/* Grid for 02–08 */}
      <div className="grid grid-cols-1 gap-0 border-t border-line-200 md:grid-cols-2 lg:grid-cols-3">
        {REST.map((c, i) => (
          <Tile key={c.n} code={code} chamber={c} index={i} />
        ))}
      </div>
    </section>
  );
}


function HeroTile({ code, chamber }: { code: string; chamber: Chamber }) {
  const Icon = chamber.icon;
  return (
    <Link
      to={chamber.to}
      params={{ code }}
      className="group relative block overflow-hidden border border-ink-950 bg-card p-8 shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gold-500" />
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8">
        <div className="text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
            Chamber
          </p>
          <div className="mt-1 font-serif text-[72px] leading-none text-ink-950" data-numeric>
            {chamber.n}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
            <Icon size={12} strokeWidth={1.5} />
            <span>The daily anchor</span>
          </div>
          <h3 className="mt-2 font-serif text-3xl leading-tight text-ink-950">{chamber.title}</h3>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-500">{chamber.blurb}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 self-end font-mono text-[11px] uppercase tracking-[0.22em] text-ink-950 md:flex">
          Enter
          <ArrowUpRight size={16} strokeWidth={1.5} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  );
}

function Tile({ code, chamber, index }: { code: string; chamber: Chamber; index: number }) {
  const Icon = chamber.icon;
  // Draw dividers as inline classes: right border on cols except last col; bottom on rows except last row.
  // Grid is 2 on md, 3 on lg; simpler to just add uniform right+bottom then negative offset border on the wrapping section — but here we handle it visually with hairlines around cells.
  return (
    <Link
      to={chamber.to}
      params={{ code }}
      className="group relative block bg-card p-6 transition hover:bg-paper-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500 border-b border-r border-line-200 md:[&:nth-child(even)]:border-r-0 lg:[&:nth-child(even)]:border-r lg:[&:nth-child(3n)]:border-r-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
            Chamber {chamber.n}
          </p>
          <h3 className="mt-3 font-serif text-xl leading-tight text-ink-950">{chamber.title}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">{chamber.blurb}</p>
        </div>
        <Icon
          size={14}
          strokeWidth={1.5}
          className="shrink-0 text-ink-500 transition group-hover:text-ink-950"
        />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-line-200 pt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
        <span className="opacity-0 transition group-hover:opacity-100">Enter</span>
        <span className="flex items-center gap-1 text-ink-950">
          <span className="font-serif text-base leading-none" data-numeric>{chamber.n}</span>
          <ArrowUpRight
            size={12}
            strokeWidth={1.5}
            className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
