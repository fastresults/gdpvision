import { Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, BookOpen, Landmark, Layers, MessageSquare, TrendingUp } from "lucide-react";

const CHAMBERS = [
  { n: "01", icon: BookOpen, title: "The National Ledger", blurb: "Authoritative decomposition of the national economy.", to: "/admin/countries/$code/ledger" as const, kind: "params" as const },
  { n: "02", icon: Layers, title: "Portfolio Workspaces", blurb: "One workspace per ministerial portfolio.", to: "/admin/countries/$code/portfolio" as const, kind: "params" as const },
  { n: "03", icon: Activity, title: "The Scenario Engine", blurb: "Consequence-free rehearsal across every downstream metric.", to: "/admin/countries/$code/scenarios" as const, kind: "params" as const },
  { n: "04", icon: TrendingUp, title: "The FDI Transition Studio", blurb: "Threat in, resilient FDI strategy out — sector by sector.", to: "/admin/countries/$code/studio" as const, kind: "params" as const },
  { n: "05", icon: MessageSquare, title: "The Narrative Chamber", blurb: "Signal to statement inside a working day.", to: "/narrative" as const, kind: "search" as const },
  { n: "06", icon: Landmark, title: "The Cabinet Room", blurb: "Consolidated national view, Session Mode, commitments register.", to: "/instrument/cabinet" as const, kind: "search" as const },

];

export function ChambersLauncher({ code }: { code: string }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Enter a chamber</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Six workspaces · one country</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {CHAMBERS.map((c) => {
          const Icon = c.icon;
          const linkProps =
            c.kind === "params"
              ? { to: c.to, params: { code } }
              : { to: c.to, search: { code, returnCode: code } };

          return (
            <Link
              key={c.n}
              {...(linkProps as any)}
              className="group relative block border border-line-200 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ink-950 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
            >
              <ArrowUpRight
                className="absolute right-4 top-4 text-ink-500 transition group-hover:text-ink-950"
                size={16}
                strokeWidth={1.5}
              />
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center border border-line-200 text-ink-950">
                  <Icon size={18} strokeWidth={1.5} />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Chamber {c.n}
                </span>
              </div>
              <h3 className="mt-4 font-serif text-lg text-ink-950">{c.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{c.blurb}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
