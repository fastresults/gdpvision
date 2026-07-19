import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Activity, BookOpen, Database, Landmark, Layers, MessageSquare, Search, TrendingUp, Users, Users2 } from "lucide-react";

import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { listOnboardingCountries } from "@/lib/country-onboarding/agents.functions";
import { flagUrl, isCaricom, isOecs } from "@/lib/caricom-registry";
import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";

const myStatusQuery = queryOptions({
  queryKey: ["my-country-status"],
  queryFn: () => getMyCountryStatus(),
});

const allCountriesQuery = queryOptions({
  queryKey: ["onboarding", "countries"],
  queryFn: () => listOnboardingCountries(),
});

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Welcome — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    const status = await context.queryClient.ensureQueryData(myStatusQuery);
    if (status.isGlobalAdmin) {
      await context.queryClient.ensureQueryData(allCountriesQuery);
    }
    return null;
  },
  component: HomePage,
});

function HomePage() {
  const { data: status } = useSuspenseQuery(myStatusQuery);
  return (
    <Shell>
      {status.isGlobalAdmin ? (
        <SuperAdminWelcome />
      ) : status.bindings.length === 0 ? (
        <NoAccessWelcome />
      ) : status.bindings.length === 1 ? (
        <CountryAdminWelcome code={status.bindings[0].country_code} name={status.bindings[0].name ?? status.bindings[0].country_code} />
      ) : (
        <CountryPickerWelcome bindings={status.bindings} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <Link to="/home"><Wordmark /></Link>
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/home" activeProps={{ className: "text-ink-950" }} className="hover:text-ink-950">Home</Link>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-8 py-14">{children}</main>
    </div>
  );
}

// ─── SUPER ADMIN ──────────────────────────────────────────────────────────────

function SuperAdminWelcome() {
  const { data: countries } = useSuspenseQuery(allCountriesQuery);
  const total = countries.length;
  const complete = countries.filter((c: any) => (c.completed_stages ?? []).length === 12).length;

  return (
    <div className="space-y-16">
      <section className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">
            Super admin · {total} sovereign instances
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-ink-950">Welcome back.</h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-500">
            Every CARICOM and OECS country in one instrument. Pick a nation to review its ledger and chambers,
            or jump straight into an operations surface.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-right font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
          <div>
            <div className="font-serif text-3xl text-emerald-700" data-numeric>{complete}</div>
            <div>Fully onboarded</div>
          </div>
          <div>
            <div className="font-serif text-3xl text-ink-950" data-numeric>{total}</div>
            <div>Total instances</div>
          </div>
        </div>
      </section>

      <CountriesGrid countries={countries as any[]} />


      <section>
        <h2 className="mb-5 font-serif text-2xl">Operations</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction icon={Database} title="Second brain" blurb="Corpus, memories, and knowledge graph." to="/admin/brain" />
          <QuickAction icon={Users2} title="Users" blurb="Manage country admins and access." to="/admin" />
          <QuickAction icon={Activity} title="Activity" blurb="Recent onboarding and system runs." to="/admin/activity" />
          <QuickAction icon={BookOpen} title="Audit log" blurb="Every commit, source, and decision." to="/admin/audits/log" />
        </div>
      </section>
    </div>
  );
}

// ─── COUNTRY ADMIN (single) ───────────────────────────────────────────────────

const CHAMBERS = [
  { n: "01", icon: BookOpen, title: "The National Ledger", blurb: "Authoritative decomposition of the national economy.", to: "/admin/countries/$code/ledger" as const },
  { n: "02", icon: Layers, title: "Portfolio Workspaces", blurb: "One workspace per ministerial portfolio.", to: "/admin/countries/$code/portfolio" as const },
  { n: "03", icon: Activity, title: "The Scenario Engine", blurb: "Consequence-free rehearsal across every downstream metric.", to: "/admin/countries/$code/scenarios" as const },
  { n: "04", icon: TrendingUp, title: "The FDI Transition Studio", blurb: "Threat in, resilient FDI strategy out.", to: "/admin/countries/$code/studio" as const },
  { n: "05", icon: MessageSquare, title: "The Narrative Chamber", blurb: "Signal to statement inside a working day.", to: "/admin/countries/$code/narrative" as const },
  { n: "06", icon: Landmark, title: "The Cabinet Room", blurb: "Prep, run, and follow through on cabinet business.", to: "/admin/countries/$code/cabinet" as const },
  { n: "07", icon: Users, title: "Synthetic Persona Lab", blurb: "Simulate publics, applicants, and stakeholders.", to: "/admin/countries/$code/personas" as const },
];

function CountryAdminWelcome({ code, name }: { code: string; name: string }) {
  const flag = flagUrl(code, "w640");
  return (
    <div className="space-y-16">
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center">
        <div className="relative aspect-[3/2] w-full overflow-hidden border border-line-200 bg-paper-100 shadow-md">
          {flag ? (
            <img src={flag} alt={`Flag of ${name}`} loading="eager" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center font-serif text-6xl text-ink-500">{code}</div>
          )}
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">
            {name} · Sovereign instrument
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-ink-950">
            Welcome to the {name} instrument.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-500">
            Your live economic picture, your scenario room, your cabinet dossier — all grounded in verified
            sources. Choose a chamber below to begin.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">Enter a chamber</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Seven workspaces · one country
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHAMBERS.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.n}
                to={c.to}
                params={{ code }}
                className="group block border border-line-200 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ink-950 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center border border-line-200">
                    <Icon size={18} strokeWidth={1.5} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    Chamber {c.n}
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-lg">{c.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{c.blurb}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── COUNTRY ADMIN (multi) ────────────────────────────────────────────────────

function CountryPickerWelcome({ bindings }: { bindings: Array<{ country_code: string; name: string | null }> }) {
  return (
    <div className="space-y-12">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">
          Your instruments · {bindings.length}
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-tight">Welcome back.</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-500">
          Choose a country to enter its sovereign instrument.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {bindings.map((b) => (
          <CountryCard
            key={b.country_code}
            code={b.country_code}
            name={b.name ?? b.country_code}
            to="/admin/countries/$code/onboard"
          />
        ))}
      </div>
    </div>
  );
}

// ─── NO ACCESS ────────────────────────────────────────────────────────────────

function NoAccessWelcome() {
  return (
    <div className="mx-auto max-w-2xl py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-500">GDPVision</p>
      <h1 className="mt-4 font-serif text-4xl">Welcome.</h1>
      <p className="mt-5 text-lg text-ink-500">
        Your account is signed in, but no country instrument has been assigned yet. Request access below and a
        super admin will provision your workspace.
      </p>
      <Link
        to="/onboarding/country"
        className="mt-8 inline-block border border-ink-950 bg-ink-950 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-transparent hover:text-ink-950"
      >
        Request country access
      </Link>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────

function CountryCard({
  code,
  name,
  gdp,
  gdpYear,
  progress,
  to,
}: {
  code: string;
  name: string;
  gdp?: number | string | null;
  gdpYear?: number | null;
  progress?: number;
  to: "/admin/countries/$code/onboard";
}) {
  const flag = flagUrl(code, "w320");
  return (
    <Link
      to={to}
      params={{ code }}
      className="group block border border-line-200 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-ink-950 hover:shadow-md"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-paper-100">
        {flag ? (
          <img src={flag} alt={`Flag of ${name}`} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center font-serif text-3xl text-ink-500">{code}</div>
        )}
      </div>
      <div className="p-3">
        <div className="font-serif text-base leading-tight text-ink-950">{name}</div>
        <div className="mt-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <span>{code}</span>
          {gdp ? (
            <span data-numeric>${(Number(gdp) / 1e9).toFixed(2)}B{gdpYear ? ` · ${gdpYear}` : ""}</span>
          ) : typeof progress === "number" ? (
            <span data-numeric>{progress}/12</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function QuickAction({
  icon: Icon,
  title,
  blurb,
  to,
}: {
  icon: typeof Database;
  title: string;
  blurb: string;
  to: "/admin/brain" | "/admin" | "/admin/activity" | "/admin/audits/log";
}) {
  return (
    <Link
      to={to}
      className="group block border border-line-200 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ink-950 hover:shadow-md"
    >
      <span className="grid h-9 w-9 place-items-center border border-line-200">
        <Icon size={18} strokeWidth={1.5} />
      </span>
      <h3 className="mt-4 font-serif text-lg">{title}</h3>
      <p className="mt-1 text-sm text-ink-500">{blurb}</p>
    </Link>
  );
}
