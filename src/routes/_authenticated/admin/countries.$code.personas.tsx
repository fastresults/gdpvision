import { createFileRoute, Link, Outlet, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Layers, FlaskConical, Wand2 } from "lucide-react";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listPersonas, listSegments } from "@/lib/personas/generate.functions";
import { listStudies } from "@/lib/personas/study.functions";

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
  const search = useSearch({ strict: false }) as { project?: string };
  const activeProjectId = typeof search.project === "string" && search.project.length > 0 ? search.project : undefined;

  const personas = useQuery({
    queryKey: ["personas", code, activeProjectId ?? "none"],
    queryFn: () => activeProjectId ? listPersonas({ data: { countryCode: code, projectId: activeProjectId } }) : Promise.resolve([]),
    enabled: !!activeProjectId,
  });
  const segments = useQuery({
    queryKey: ["persona-segments", code, activeProjectId ?? "none"],
    queryFn: () => activeProjectId ? listSegments({ data: { countryCode: code, projectId: activeProjectId } }) : Promise.resolve([]),
    enabled: !!activeProjectId,
  });
  const studies = useQuery({
    queryKey: ["studies", code, activeProjectId ?? "none"],
    queryFn: () => listStudies({ data: { countryCode: code, projectId: activeProjectId } }),
    enabled: !!activeProjectId,
  });

  const pCount = personas.data?.length ?? 0;
  const sCount = segments.data?.length ?? 0;
  const stCount = studies.data?.length ?? 0;

  const stages = [
    {
      n: 1,
      to: "/admin/countries/$code/personas" as const,
      exact: true,
      icon: Users,
      label: "Cast the room",
      sub: "Personas",
      count: pCount,
      hint: pCount === 0 ? "Empty — generate voices" : `${pCount} synthetic voices`,
      state: pCount > 0 ? ("ready" as const) : ("empty" as const),
      unlocked: true,
    },
    {
      n: 2,
      to: "/admin/countries/$code/personas/segments" as const,
      exact: false,
      icon: Layers,
      label: "Group your public",
      sub: "Segments",
      count: sCount,
      hint: pCount === 0 ? "Needs personas first" : sCount === 0 ? "No segments yet" : `${sCount} audiences`,
      state: sCount > 0 ? ("ready" as const) : pCount > 0 ? ("empty" as const) : ("locked" as const),
      unlocked: pCount > 0,
    },
    {
      n: 3,
      to: "/admin/countries/$code/personas/studies" as const,
      exact: false,
      icon: FlaskConical,
      label: "Rehearse the conversation",
      sub: "Studies",
      count: stCount,
      hint: sCount === 0 ? "Needs a segment first" : stCount === 0 ? "No studies yet" : `${stCount} studies`,
      state: stCount > 0 ? ("ready" as const) : sCount > 0 ? ("empty" as const) : ("locked" as const),
      unlocked: sCount > 0,
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
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="min-w-0 space-y-5 border-r border-line-200 pr-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Synthetic Persona Lab
            </p>
            <h1 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
              Ask a synthetic public.<br />Before the real one asks you.
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-700">
              Cast a public → group them → rehearse the conversation. AI grounds every voice in {code}&rsquo;s
              second brain.
            </p>
          </div>

          <Link
            to="/admin/countries/$code/personas"
            params={{ code }}
            className="block border border-ink-950 bg-ink-950 p-3 text-paper-0 hover:bg-ink-700"
          >
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]">
              <Wand2 size={11} /> Research Studio
            </p>
            <p className="mt-1 font-serif text-[15px] leading-tight">Auto-run a full study</p>
            <p className="mt-1 text-[11px] leading-snug text-paper-0/70">
              AI casts, questions and synthesizes end-to-end.
            </p>
          </Link>

          <nav>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Guided path</p>
            <ol className="mt-2 flex flex-col">
              {stages.map((s, i) => {
                const isLast = i === stages.length - 1;
                const Icon = s.icon;
                const dot =
                  s.state === "ready"
                    ? "bg-emerald-500"
                    : s.state === "empty"
                      ? "bg-amber-500"
                      : "bg-ink-300";
                return (
                  <li key={s.to} className="relative">
                    {!isLast && (
                      <span
                        aria-hidden
                        className={`absolute left-[19px] top-[38px] h-[calc(100%-24px)] w-px ${
                          s.state === "ready" ? "bg-ink-950" : "bg-line-200"
                        }`}
                      />
                    )}
                    <Link
                      to={s.to}
                      params={{ code }}
                      activeOptions={{ exact: s.exact }}
                      activeProps={{ className: "bg-paper-100" }}
                      className="relative flex items-start gap-3 rounded-sm py-2 pl-2 pr-2 hover:bg-paper-100"
                    >
                      <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-200 bg-paper-0">
                        <Icon size={13} className="text-ink-950" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                            {s.n.toString().padStart(2, "0")}
                          </span>
                          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                            {s.sub}
                          </span>
                        </div>
                        <p className="mt-0.5 font-serif text-[13px] leading-tight text-ink-950">
                          {s.label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{s.hint}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <Link
            to="/admin/countries/$code/onboard"
            params={{ code }}
            className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
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
