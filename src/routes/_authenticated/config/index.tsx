import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listInstanceBindings } from "@/lib/ledger.functions";
import { CARICOM_OECS_REGISTRY } from "@/lib/caricom-registry";
import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";

const bindingsQuery = queryOptions({ queryKey: ["instance-bindings"], queryFn: () => listInstanceBindings() });

export const Route = createFileRoute("/_authenticated/config/")({
  head: () => ({
    meta: [
      { title: "Country Configuration — GDPVision" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Provisioning surface: the CARICOM/OECS registry and this instance's country bindings." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: ConfigPage,
});

function ConfigPage() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const navigate = useNavigate();
  const bound = new Set(bindings.map((b) => b.country_code));
  const defaultCode = bindings.find((b) => b.is_default)?.country_code;

  const tiers = [
    { key: "caricom-full", label: "CARICOM full members" },
    { key: "caricom-associate", label: "CARICOM associate members" },
    { key: "oecs-associate", label: "OECS associate members" },
  ] as const;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Configuration</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/admin" className="hover:text-ink-950">Admin</Link>
          <Link to="/codex" className="hover:text-ink-950">Codex</Link>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Instance provisioning</p>
        <h1 className="mt-2 font-serif text-4xl">The registry</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-500">
          Twenty-two CARICOM &amp; OECS member states. Your default instance appears in the header; additional bindings widen the
          set of nations you can address in the Cabinet Room. Provisioning changes are performed in Admin.
        </p>

        <div className="mt-12 space-y-12">
          {tiers.map((tier) => {
            const rows = CARICOM_OECS_REGISTRY.filter((r) => r.tier === tier.key);
            return (
              <section key={tier.key}>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">{tier.label}</h2>
                <ul className="mt-4 divide-y divide-line-200 border-y border-line-200">
                  {rows.map((r) => {
                    const isBound = bound.has(r.code);
                    const isDefault = r.code === defaultCode;
                    return (
                      <li key={r.code} className="grid grid-cols-[64px_1fr_auto_auto] items-baseline gap-4 py-3 text-sm">
                        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">{r.code}</span>
                        <span>{r.name}{r.cbiState && <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">CBI</span>}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                          {isBound ? "Bound" : "—"}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-widest">
                          {isDefault ? <span className="text-ink-950">Default</span> : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="mt-16 border-t border-line-200 pt-8 text-sm text-ink-500">
          Need to add or remove a binding? <Link to="/admin" className="text-ink-950 underline">Open Admin</Link>.
        </div>
      </main>
    </div>
  );
}
