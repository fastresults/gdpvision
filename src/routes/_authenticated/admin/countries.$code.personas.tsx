import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Users, Layers, FlaskConical, Info } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas")({
  head: ({ params }) => ({
    meta: [
      { title: `Persona Lab · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center bg-paper-0 p-8">
      <p className="max-w-md text-sm text-rose-600">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm text-ink-500">Persona Lab not found.</div>,
  component: PersonasLayout,
});

function PersonasLayout() {
  const { code } = Route.useParams();
  const nav = [
    {
      to: "/admin/countries/$code/personas" as const,
      label: "Personas",
      icon: Users,
      exact: true,
      brief: {
        what: "AI-generated synthetic citizens grounded in this country's second brain — livelihood, sentiment, media diet and more.",
        use: "Pressure-test a policy, message or product against real-feeling voices before a single dollar or dispatch.",
        value: "Surfaces objections, hopes and blind spots from constituents you'd otherwise miss in the room.",
      },
    },
    {
      to: "/admin/countries/$code/personas/segments" as const,
      label: "Segments",
      icon: Layers,
      brief: {
        what: "Coherent groups of personas sharing geography, livelihood or attitude — your decision-ready audiences.",
        use: "Targeting a program, tailoring comms, or sizing an intervention across the population.",
        value: "Converts millions of citizens into a handful of audiences a Cabinet can actually act on.",
      },
    },
    {
      to: "/admin/countries/$code/personas/studies" as const,
      label: "Studies",
      icon: FlaskConical,
      brief: {
        what: "Structured surveys and focus groups run against your personas and segments, with cited synthesis.",
        use: "When you need directional evidence in hours, not weeks — ahead of a launch, vote or press cycle.",
        value: "De-risks decisions with reproducible, source-grounded signal before committing to field research.",
      },
    },
  ];
  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Chamber 07 · Persona Lab" },
      ]}
    >
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="min-w-0 space-y-4 border-r border-line-200 pr-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Synthetic Persona Lab
            </p>
            <h1 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
              Ask a synthetic public.<br />Before the real one asks you.
            </h1>
            <p className="mt-3 text-sm text-ink-700">
              Generate personas grounded in {code}&rsquo;s second brain. Run surveys,
              focus groups, and creative tests before you spend a dollar in the field.
            </p>
          </div>
          <nav className="flex flex-col">
            {nav.map(({ to, label, icon: Icon, exact, brief }) => (
              <div key={to} className="group/nav relative flex items-stretch">
                <Link
                  to={to}
                  params={{ code }}
                  activeOptions={{ exact }}
                  className="flex flex-1 items-center gap-2 border-l-2 border-transparent px-3 py-2 pr-9 text-sm text-ink-700 hover:text-ink-950"
                  activeProps={{ className: "border-ink-950 bg-paper-100 text-ink-950" }}
                >
                  <Icon size={14} /> {label}
                </Link>
                <NavInfo label={label} brief={brief} />
              </div>
            ))}
          </nav>
          <Link
            to="/admin/countries/$code/onboard"
            params={{ code }}
            className="mt-6 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
          >
            ← Back to country
          </Link>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </SuperAdminShell>
  );
}

type Brief = { what: string; use: string; value: string };

function NavInfo({ label, brief }: { label: string; brief: Brief }) {
  const body = (
    <div className="space-y-2.5 text-[13px] leading-snug text-ink-800">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">What it is</p>
        <p>{brief.what}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">When to use</p>
        <p>{brief.use}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Why it matters</p>
        <p>{brief.value}</p>
      </div>
    </div>
  );
  const trigger = (
    <button
      type="button"
      aria-label={`About ${label}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 opacity-0 transition hover:text-ink-950 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-400 group-hover/nav:opacity-100"
    >
      <Info size={13} />
    </button>
  );
  return (
    <>
      <span className="hidden md:contents">
        <HoverCard openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-72">
            {body}
          </HoverCardContent>
        </HoverCard>
      </span>
      <span className="contents md:hidden">
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-72">
            {body}
          </PopoverContent>
        </Popover>
      </span>
    </>
  );
}
