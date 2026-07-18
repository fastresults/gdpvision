import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/scenarios/")({
  head: ({ params }) => ({
    meta: [
      { title: `Scenarios · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScenariosIndex,
});

function ScenariosIndex() {
  const { code } = Route.useParams();
  return (
    <div className="grid min-h-[60dvh] place-items-center px-8 py-16">
      <div className="max-w-lg text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Chamber 03
        </p>
        <h2 className="mt-3 font-serif text-2xl text-ink-950">
          Rehearse a policy move without consequence.
        </h2>
        <p className="mt-3 text-sm text-ink-500">
          Draft a scenario, pull levers, and read the ripple across every downstream metric — GDP,
          sector composition, exposure, attribution — before it hits Cabinet.
        </p>
        <Link
          to="/admin/countries/$code/scenarios/new"
          params={{ code }}
          className="mt-6 inline-flex items-center gap-2 border border-ink-950 bg-ink-950 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700"
        >
          Draft new scenario →
        </Link>
      </div>
    </div>
  );
}
