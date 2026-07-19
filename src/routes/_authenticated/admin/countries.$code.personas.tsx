import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Users, Layers, FlaskConical } from "lucide-react";

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
    { to: "/admin/countries/$code/personas" as const, label: "Personas", icon: Users, exact: true },
    { to: "/admin/countries/$code/personas/segments" as const, label: "Segments", icon: Layers },
    { to: "/admin/countries/$code/personas/studies" as const, label: "Studies", icon: FlaskConical },
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
            {nav.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                params={{ code }}
                activeOptions={{ exact }}
                className="flex items-center gap-2 border-l-2 border-transparent px-3 py-2 text-sm text-ink-700 hover:text-ink-950"
                activeProps={{ className: "border-ink-950 bg-paper-100 text-ink-950" }}
              >
                <Icon size={14} /> {label}
              </Link>
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
