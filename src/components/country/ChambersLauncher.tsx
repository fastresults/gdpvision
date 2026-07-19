import { Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, BookOpen, Landmark, Layers, MessageSquare, TrendingUp, Users } from "lucide-react";

import ch01 from "@/assets/chambers/chamber-01.jpg.asset.json";
import ch02 from "@/assets/chambers/chamber-02.jpg.asset.json";
import ch03 from "@/assets/chambers/chamber-03.jpg.asset.json";
import ch04 from "@/assets/chambers/chamber-04.jpg.asset.json";
import ch05 from "@/assets/chambers/chamber-05.jpg.asset.json";
import ch06 from "@/assets/chambers/chamber-06.jpg.asset.json";
import ch07 from "@/assets/chambers/chamber-07.jpg.asset.json";

const CHAMBERS = [
  { n: "01", icon: BookOpen, title: "The National Ledger", blurb: "Authoritative decomposition of the national economy.", img: ch01.url, to: "/admin/countries/$code/ledger" as const },
  { n: "02", icon: Layers, title: "Portfolio Workspaces", blurb: "One workspace per ministerial portfolio.", img: ch02.url, to: "/admin/countries/$code/portfolio" as const },
  { n: "03", icon: Activity, title: "The Scenario Engine", blurb: "Consequence-free rehearsal across every downstream metric.", img: ch03.url, to: "/admin/countries/$code/scenarios" as const },
  { n: "04", icon: TrendingUp, title: "The FDI Transition Studio", blurb: "Threat in, resilient FDI strategy out — sector by sector.", img: ch04.url, to: "/admin/countries/$code/studio" as const },
  { n: "05", icon: MessageSquare, title: "The Narrative Chamber", blurb: "Signal to statement inside a working day.", img: ch05.url, to: "/admin/countries/$code/narrative" as const },
  { n: "06", icon: Landmark, title: "The Cabinet Room", blurb: "Prep, run, and follow through on cabinet business.", img: ch06.url, to: "/admin/countries/$code/cabinet" as const },
  { n: "07", icon: Users, title: "Synthetic Persona Lab", blurb: "Simulate publics, applicants, and stakeholders — grounded in the second brain.", img: ch07.url, to: "/admin/countries/$code/personas" as const },
];

export function ChambersLauncher({ code }: { code: string }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Enter a chamber</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Seven workspaces · one country</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {CHAMBERS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.n}
              to={c.to}
              params={{ code }}
              className="group relative block overflow-hidden border border-line-200 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-ink-950 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
            >
              <div className="relative aspect-[3/1] w-full overflow-hidden border-b border-line-200 bg-paper-100">
                <img
                  src={c.img}
                  alt={`${c.title} preview`}
                  loading="lazy"
                  className="h-full w-full object-cover object-top opacity-90 transition group-hover:opacity-100 group-hover:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/60 via-white/0 to-white/0" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 border border-line-200 bg-white/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 backdrop-blur">
                  <Icon size={12} strokeWidth={1.5} /> Chamber {c.n}
                </span>
              </div>
              <div className="p-5">
                <ArrowUpRight
                  className="absolute right-4 top-4 text-white/90 drop-shadow transition group-hover:text-white"
                  size={16}
                  strokeWidth={1.5}
                />
                <h3 className="font-serif text-lg text-ink-950">{c.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{c.blurb}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
