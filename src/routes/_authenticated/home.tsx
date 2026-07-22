import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Database, Landmark, Layers, MessageSquare, Search, TrendingUp, Users, Users2 } from "lucide-react";

import { getMyCountryStatus } from "@/lib/country-admin.functions";
import { listOnboardingCountries } from "@/lib/country-onboarding/agents.functions";
import { flagUrl, isCaricom, isOecs } from "@/lib/caricom-registry";
import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { checkAccessAllowed } from "@/lib/invitations.functions";
import { useImpersonation } from "@/lib/impersonation";

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
  const navigate = useNavigate();
  const { state: viewAs } = useImpersonation();
  useEffect(() => {
    let cancelled = false;
    checkAccessAllowed().then(async (res) => {
      if (cancelled) return;
      if (!res.allowed) {
        await supabase.auth.signOut();
        navigate({ to: "/auth", search: { blocked: 1 } as any });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [navigate]);

  // Super admin has activated "View as country user" mode → render the
  // country-admin welcome for the impersonated country.
  if (status.isGlobalAdmin && viewAs) {
    return (
      <Shell>
        <CountryAdminWelcome code={viewAs.country_code} name={countryName(viewAs.country_code)} />
      </Shell>
    );
  }

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

function countryName(code: string): string {
  const map: Record<string, string> = {
    ATG: "Antigua and Barbuda",
    LCA: "Saint Lucia",
    KNA: "Saint Kitts and Nevis",
    BRB: "Barbados",
    TTO: "Trinidad and Tobago",
    JAM: "Jamaica",
    GUY: "Guyana",
    DMA: "Dominica",
    GRD: "Grenada",
    VCT: "Saint Vincent and the Grenadines",
  };
  return map[code.toUpperCase()] ?? code.toUpperCase();
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
  const { enter: enterViewAs } = useImpersonation();
  const navigate = useNavigate();
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

      <section>
        <h2 className="mb-2 font-serif text-2xl">Testing · View as country user</h2>
        <p className="mb-5 max-w-2xl text-sm text-ink-500">
          Preview the app exactly as an authorised country user would see it. Server permissions are unchanged;
          this only changes what your browser renders. Exit any time from the amber banner at the top.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { code: "ATG", name: "Antigua and Barbuda" },
            { code: "LCA", name: "Saint Lucia" },
            { code: "KNA", name: "Saint Kitts and Nevis" },
          ].map((c) => (
            <button
              key={c.code}
              onClick={() => {
                enterViewAs(c.code);
                navigate({ to: "/home" });
              }}
              className="group flex items-center gap-4 border border-line-200 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-ink-950 hover:shadow-md"
            >
              <img src={flagUrl(c.code, "w160") ?? undefined} alt="" className="h-10 w-14 border border-line-200 object-cover" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">View as · {c.code}</div>
                <div className="font-serif text-base text-ink-950">{c.name}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── COUNTRY ADMIN (single) ───────────────────────────────────────────────────

function CountryAdminWelcome({ code, name }: { code: string; name: string }) {
  return (
    <div className="space-y-20">
      <CountryMasthead code={code} name={name} />
      <ConciergeInvitationCard />
      <ChambersLauncher code={code} />
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

type MembershipFilter = "all" | "caricom" | "oecs";

function CountriesGrid({ countries }: { countries: any[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<MembershipFilter>("all");

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return countries
      .filter((c) => {
        if (filter === "caricom" && !isCaricom(c.code)) return false;
        if (filter === "oecs" && !isOecs(c.code)) return false;
        if (!qq) return true;
        return (
          c.name.toLowerCase().includes(qq) ||
          (c.iso3 ?? "").toLowerCase().includes(qq) ||
          c.code.toLowerCase().includes(qq)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, q, filter]);

  const counts = useMemo(
    () => ({
      all: countries.length,
      caricom: countries.filter((c) => isCaricom(c.code)).length,
      oecs: countries.filter((c) => isOecs(c.code)).length,
    }),
    [countries],
  );

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Countries</h2>
        <Link to="/admin/countries" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">
          Countries queue →
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or code…"
            className="w-full border border-line-200 bg-transparent py-2 pl-9 pr-3 text-sm focus:border-ink-950 focus:outline-none"
          />
        </div>
        {(["all", "caricom", "oecs"] as MembershipFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border transition ${
              filter === f
                ? "border-ink-950 bg-ink-950 text-paper-0"
                : "border-line-200 text-ink-500 hover:text-ink-950"
            }`}
          >
            {f === "all" ? "All" : f.toUpperCase()}
            <span className="ml-1.5 opacity-60" data-numeric>{counts[f]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="border border-line-200 px-4 py-12 text-center text-sm text-ink-500">
          No countries match.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((c: any) => (
            <CountryCard
              key={c.code}
              code={c.code}
              name={c.name}
              gdp={c.gdp_current_usd}
              gdpYear={c.gdp_year}
              progress={(c.completed_stages ?? []).length}
              to="/admin/countries/$code/onboard"
            />
          ))}
        </div>
      )}
    </section>
  );
}


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
        <div className="absolute left-2 top-2 flex gap-1">
          {isOecs(code) && (
            <span
              title="OECS member state"
              className="rounded-sm bg-ink-950/85 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-paper-0 backdrop-blur"
            >
              OECS
            </span>
          )}
          {isCaricom(code) && (
            <span
              title="CARICOM member"
              className="rounded-sm bg-paper-0/90 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-ink-950 backdrop-blur"
            >
              CARICOM
            </span>
          )}
        </div>
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
