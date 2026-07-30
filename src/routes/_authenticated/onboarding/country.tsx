import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { listCountries } from "@/lib/admin.functions";
import { getMyCountryStatus, requestCountryAccess } from "@/lib/country-admin.functions";
import { scrollToTop } from "@/lib/utils";

const statusQuery = queryOptions({
  queryKey: ["my-country-status"],
  queryFn: () => getMyCountryStatus(),
});
const countriesQuery = queryOptions({
  queryKey: ["onboarding-countries"],
  queryFn: () => listCountries(),
});

export const Route = createFileRoute("/_authenticated/onboarding/country")({
  head: () => ({
    meta: [
      { title: "Choose your country — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    const status = await context.queryClient.ensureQueryData(statusQuery);
    // Super admins get the country onboarding dashboard, not the picker.
    if (status.isGlobalAdmin) throw redirect({ to: "/admin/countries" });
    await context.queryClient.ensureQueryData(countriesQuery);
  },
  component: OnboardingCountryPage,
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center p-8 text-center">
      <p className="text-sm text-red-600">{error.message}</p>
    </div>
  ),
});

function OnboardingCountryPage() {
  const { data: status } = useSuspenseQuery(statusQuery);
  const { data: countries } = useSuspenseQuery(countriesQuery);
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(countries[0]?.code ?? "");
  const [note, setNote] = useState("");

  const request = useServerFn(requestCountryAccess);
  const mut = useMutation({
    mutationFn: (v: { countryCode: string; note?: string }) =>
      request({ data: { countryCode: v.countryCode, note: v.note } }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["my-country-status"] });
      await qc.invalidateQueries({ queryKey: ["instance-bindings"] });
      if (res?.autoApproved) {
        router.invalidate();
        navigate({ to: "/instrument" });
      }
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countries, query]);

  const alreadyBound = status.bindings.length > 0;
  const pendingByCode = new Map(status.pendingRequests.map((r) => [r.country_code, r]));

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <button type="button" onClick={() => scrollToTop()} className="shrink-0 focus-visible:outline-none">
          <Wordmark />
        </button>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {alreadyBound && (
            <Link to="/instrument" className="hover:text-ink-950">
              Open instrument
            </Link>
          )}
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Onboarding</p>
        <h1 className="mt-2 font-serif text-4xl">Which country do you serve?</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
          {status.isGlobalAdmin
            ? "You are a super administrator — pick any country to bind yourself to it. You can add more from the admin console."
            : "Pick your country. A country administrator (or a super administrator) reviews the request before you get access to the instrument. This protects each nation's data from being read by users who do not belong to it."}
        </p>

        {status.pendingRequests.length > 0 && (
          <section className="mt-10 border border-line-200 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Pending requests</p>
            <ul className="mt-3 space-y-2 text-sm">
              {status.pendingRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>
                    {r.name ?? r.country_code}{" "}
                    <span className="font-mono text-[10px] text-ink-500">({r.country_code})</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    awaiting country admin
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {status.bindings.length > 0 && (
          <section className="mt-6 border border-line-200 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">You are bound to</p>
            <ul className="mt-3 space-y-2 text-sm">
              {status.bindings.map((b) => (
                <li key={b.country_code} className="flex items-center justify-between">
                  <span>
                    {b.name ?? b.country_code}{" "}
                    <span className="font-mono text-[10px] text-ink-500">({b.country_code})</span>
                    {b.is_default && <span className="ml-2 text-[10px] uppercase tracking-widest text-gold-500">default</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Search countries</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Haiti, Jamaica, LCA…"
              className="mt-2 w-full border-b border-line-200 bg-transparent py-2 text-lg focus:border-ink-950 focus:outline-none"
            />
          </label>

          <ul className="mt-6 max-h-96 space-y-1 overflow-y-auto border border-line-200 p-2">
            {filtered.map((c) => {
              const isPending = pendingByCode.has(c.code);
              const isBound = status.bindings.some((b) => b.country_code === c.code);
              const isSelected = selected === c.code;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    disabled={isBound || isPending}
                    onClick={() => setSelected(c.code)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected ? "bg-ink-950 text-paper-0" : "hover:bg-paper-100"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <span>
                      {c.name}{" "}
                      <span className="font-mono text-[10px] opacity-70">({c.code})</span>
                    </span>
                    {isBound && <span className="font-mono text-[10px] uppercase">bound</span>}
                    {isPending && <span className="font-mono text-[10px] uppercase">pending</span>}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink-500">No countries match "{query}"</li>
            )}
          </ul>

          {!status.isGlobalAdmin && (
            <label className="mt-6 block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Note to the country administrator (optional)
              </span>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Who you are, which ministry you belong to, why you need access…"
                className="mt-2 w-full border border-line-200 bg-transparent p-2 text-sm focus:border-ink-950 focus:outline-none"
              />
            </label>
          )}

          {mut.error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {(mut.error as Error).message}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={!selected || mut.isPending}
              onClick={() => mut.mutate({ countryCode: selected, note: note || undefined })}
              className="border-l-2 border-gold-500 bg-ink-950 px-6 py-3 text-sm uppercase tracking-widest text-paper-0 transition-colors hover:bg-ink-700 disabled:opacity-40"
            >
              {mut.isPending
                ? "Sending…"
                : status.isGlobalAdmin
                ? `Bind me to ${selected || "…"}`
                : `Request access to ${selected || "…"}`}
            </button>
            {mut.isSuccess && !status.isGlobalAdmin && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Request sent
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
