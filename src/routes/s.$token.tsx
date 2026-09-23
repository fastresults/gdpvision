import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { RegionMap, type MapFeature } from "@/components/sovereign-eye/RegionMap";
import { getPublicSovereignEyeScene } from "@/lib/sovereign-eye.functions";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Shared Sovereign Eye scene" },
      { name: "description", content: "A shared sovereign intelligence map scene." },
      { property: "og:title", content: "Shared Sovereign Eye scene" },
      { property: "og:description", content: "A shared sovereign intelligence map scene." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedSceneRoute,
});

function SharedSceneRoute() {
  const { token } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-sovereign-eye", token],
    queryFn: () => getPublicSovereignEyeScene({ data: { token } }),
    retry: false,
  });
  const [pinnedFeature, setPinnedFeature] = useState<MapFeature | null>(null);

  return (
    <main className="min-h-dvh bg-paper-0 px-5 py-8 text-ink-950 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {isLoading ? <p className="text-sm text-ink-500">Loading shared scene…</p> : null}
        {error ? <p className="text-sm text-signal-negative">{error.message}</p> : null}
        {data ? (
          <article className="space-y-6">
            <header className="border-b border-line-200 pb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Shared scene</p>
              <h1 className="mt-2 font-serif text-4xl leading-tight text-ink-950">{data.title}</h1>
              {data.description ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-600">{data.description}</p> : null}
            </header>
            <RegionMap
              code={data.countryCode}
              countryName={data.title}
              layers={data.layers}
              focusedLayerId={data.layers.find((layer) => layer.visible)?.id ?? data.layers[0]?.id ?? "macro-pulse"}
              pinnedFeature={pinnedFeature}
              onPin={setPinnedFeature}
            />
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.layers.map((layer) => (
                <div key={layer.id} className="border border-line-200 bg-card p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{layer.kind}</p>
                  <h2 className="mt-2 font-serif text-2xl text-ink-950">{layer.label}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{layer.narrative}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <SmallStat label="Strength" value={layer.strength == null ? "—" : layer.strength.toFixed(2)} />
                    <SmallStat label="Evidence" value={String(layer.evidenceCount)} />
                    <SmallStat label="Status" value={layer.status} />
                  </div>
                </div>
              ))}
            </section>
            {data.notes ? <section className="whitespace-pre-wrap border border-line-200 bg-paper-50 p-5 text-sm leading-relaxed text-ink-800">{data.notes}</section> : null}
          </article>
        ) : null}
      </div>
    </main>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-100 p-2">
      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-1 truncate text-sm text-ink-950" data-numeric>{value}</p>
    </div>
  );
}