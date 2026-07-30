import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  activateCountryPack,
  deactivateCountryPack,
  generateNationalSignature,
  listCountryPacks,
  previewCountryPack,
  type CountryPackPreview,
} from "@/lib/config.functions";
import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { scrollToTop } from "@/lib/utils";

const packsQuery = queryOptions({ queryKey: ["country-packs"], queryFn: () => listCountryPacks() });

export const Route = createFileRoute("/_authenticated/config/")({
  head: () => ({
    meta: [
      { title: "Country Configuration — GDPVision" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Provision instances: browse the CARICOM/OECS registry, review Country Packs, and generate National Signatures.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(packsQuery),
  component: ConfigPage,
});

const TIERS = [
  { key: "caricom-full", label: "CARICOM full members" },
  { key: "caricom-associate", label: "CARICOM associate members" },
  { key: "oecs-associate", label: "OECS associate members" },
] as const;

function ConfigPage() {
  const { data: packs } = useSuspenseQuery(packsQuery);
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument" onClick={() => scrollToTop()}>
            <Wordmark />
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Configuration
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <Link to="/admin" className="hover:text-ink-950">
            Admin
          </Link>
          <Link to="/codex" className="hover:text-ink-950">
            Codex
          </Link>
          <button onClick={signOut} className="hover:text-ink-950">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-12 px-8 py-16">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            Instance provisioning · Screen 0
          </p>
          <h1 className="mt-2 font-serif text-4xl">The registry</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-500">
            Twenty-two CARICOM &amp; OECS member states. Select a row to review the Country Pack and
            activate the instance for yourself.
          </p>

          <div className="mt-10 space-y-10">
            {TIERS.map((tier) => {
              const rows = packs.filter((r) => r.tier === tier.key);
              return (
                <section key={tier.key}>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                    {tier.label}
                  </h2>
                  <ul className="mt-3 divide-y divide-line-200 border-y border-line-200">
                    {rows.map((r) => {
                      const isSel = selected === r.code;
                      return (
                        <li key={r.code}>
                          <button
                            onClick={() => setSelected(r.code)}
                            className={`grid w-full grid-cols-[64px_1fr_auto_auto_auto] items-baseline gap-4 py-3 text-left text-sm ${isSel ? "bg-paper-100" : "hover:bg-paper-50"}`}
                          >
                            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
                              {r.code}
                            </span>
                            <span>
                              {r.name}
                              {r.cbiState && (
                                <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                                  CBI
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                              {r.currency}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                              {r.isBound ? "Bound" : "—"}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest">
                              {r.isDefault ? <span className="text-ink-950">Default</span> : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </section>

        <aside className="sticky top-8 h-fit border-l border-line-200 pl-8">
          {selected ? (
            <PackPanel code={selected} />
          ) : (
            <div className="text-sm text-ink-500">
              Select a nation to review the Country Pack, activate the instance, confirm the
              portfolio→sector map, and generate the National Signature.
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

const previewQuery = (code: string) =>
  queryOptions({
    queryKey: ["country-pack", code],
    queryFn: () => previewCountryPack({ data: { code } }),
  });

function PackPanel({ code }: { code: string }) {
  const { data } = useSuspenseQuery(previewQuery(code));
  const qc = useQueryClient();
  const activate = useServerFn(activateCountryPack);
  const deactivate = useServerFn(deactivateCountryPack);
  const genSig = useServerFn(generateNationalSignature);

  const activateMut = useMutation({
    mutationFn: (v: { makeDefault: boolean }) =>
      activate({ data: { code, makeDefault: v.makeDefault } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["country-packs"] }),
  });
  const deactivateMut = useMutation({
    mutationFn: () => deactivate({ data: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["country-packs"] }),
  });
  const genSigMut = useMutation({
    mutationFn: () => genSig({ data: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["country-pack", code] }),
  });

  return (
    <div className="space-y-8 text-sm">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          {data.code} · {data.tier}
          {data.cbiState ? " · CBI" : ""}
        </p>
        <h2 className="mt-1 font-serif text-2xl">{data.name}</h2>
        <p className="mt-1 font-mono text-[11px] text-ink-500">
          {data.currency} · FY starts month {data.fiscalYearStartMonth}
          {data.nso ? ` · NSO: ${data.nso}` : ""}
          {data.centralBank ? ` · ${data.centralBank}` : ""}
        </p>
      </header>

      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => activateMut.mutate({ makeDefault: false })}
            disabled={activateMut.isPending}
            className="rounded border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
          >
            Activate
          </button>
          <button
            onClick={() => activateMut.mutate({ makeDefault: true })}
            disabled={activateMut.isPending}
            className="rounded border border-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
          >
            Set as default
          </button>
          <button
            onClick={() => deactivateMut.mutate()}
            disabled={deactivateMut.isPending}
            className="rounded border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:border-red-500 hover:text-red-600 disabled:opacity-40"
          >
            Remove binding
          </button>
        </div>
      </section>

      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          Portfolio → sector map
        </h3>
        <ul className="mt-3 divide-y divide-line-200 border-y border-line-200">
          {data.portfolioMap.map((r) => (
            <li key={r.sectorSlug} className="grid grid-cols-[1fr_auto] gap-3 py-2 text-[13px]">
              <span>{r.sectorLabel}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                {r.ministry ?? "unassigned"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          Sector shares
        </h3>
        {data.sectorShares.length === 0 ? (
          <p className="mt-2 font-mono text-[11px] text-ink-500">No seed data.</p>
        ) : (
          <ul className="mt-3 space-y-1 font-mono text-[11px]">
            {data.sectorShares.map((s) => (
              <li key={s.sector_code} className="grid grid-cols-[1fr_auto_auto] gap-3">
                <span>{s.label}</span>
                <span>{s.share_pct != null ? `${s.share_pct}%` : "—"}</span>
                <span className="text-ink-500">{s.confidence_grade ?? "?"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SignaturePanel
        preview={data}
        pending={genSigMut.isPending}
        onGenerate={() => genSigMut.mutate()}
        error={genSigMut.error as Error | null}
      />
    </div>
  );
}

function SignaturePanel({
  preview,
  pending,
  onGenerate,
  error,
}: {
  preview: CountryPackPreview;
  pending: boolean;
  onGenerate: () => void;
  error: Error | null;
}) {
  const sig = preview.signature;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          National Signature
        </h3>
        <button
          onClick={onGenerate}
          disabled={pending}
          className="rounded border border-ink-950 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
        >
          {pending ? "Generating…" : sig ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-600">{error.message}</p>}
      {!sig ? (
        <p className="mt-3 font-mono text-[11px] text-ink-500">
          The generative identity artifact. Requires admin.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="font-serif text-lg leading-tight">{sig.headline}</p>
          <p className="text-[13px] italic text-ink-500">{sig.tagline}</p>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Pillars
            </h4>
            <ul className="mt-1 space-y-1 text-[12px]">
              {sig.pillars.map((p) => (
                <li key={p.name}>
                  <span className="font-medium">{p.name}.</span> {p.thesis}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Distinctives
            </h4>
            <ul className="mt-1 list-disc pl-4 text-[12px]">
              {sig.distinctives.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Risks</h4>
            <ul className="mt-1 list-disc pl-4 text-[12px]">
              {sig.risks.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          {preview.signatureGeneratedAt && (
            <p className="font-mono text-[10px] text-ink-500">
              Generated {new Date(preview.signatureGeneratedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
