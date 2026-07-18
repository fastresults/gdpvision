import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, GitFork, Pin, PinOff } from "lucide-react";

import { getScenario, promoteScenario, type ScenarioArtifact } from "@/lib/scenarios.functions";
import type { EngineOutput } from "@/lib/engine/v1_macro";
import { GdpFanChart } from "@/components/scenarios/GdpFanChart";
import { SectorWaterfall } from "@/components/scenarios/SectorWaterfall";
import { AttributionStack } from "@/components/scenarios/AttributionStack";
import { NarrativePanel } from "@/components/scenarios/NarrativePanel";
import { readPins, writePins } from "./countries.$code.scenarios";

function scenarioQuery(id: string) {
  return queryOptions({
    queryKey: ["scenario-artifact", id],
    queryFn: () => getScenario({ data: { id } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/scenarios/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Scenario · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(scenarioQuery(params.id)),
  component: ScenarioViewer,
});

function ScenarioViewer() {
  const { code, id } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(scenarioQuery(id));
  const artifact: ScenarioArtifact = data;
  const results = artifact.results as EngineOutput | Record<string, never>;
  const hasResults = "years" in results;

  const [pinned, setPinned] = useState(false);
  useEffect(() => setPinned(readPins(code).includes(id)), [code, id]);
  function togglePin() {
    const cur = readPins(code);
    const next = pinned ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 4);
    writePins(code, next);
    setPinned(!pinned);
    window.dispatchEvent(new Event("chamber03:pins"));
  }

  const promote = useMutation({
    mutationFn: (toStatus: "shared" | "adopted" | "archived") =>
      promoteScenario({ data: { id, toStatus } }),
    onSuccess: () => window.location.reload(),
  });

  const assumptionsNote =
    typeof artifact.assumptions?.note === "string" ? (artifact.assumptions.note as string) : "";
  const narrativeMd =
    typeof artifact.assumptions?.narrative_md === "string"
      ? (artifact.assumptions.narrative_md as string)
      : null;

  return (
    <div className="p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            <span className="mr-2 border border-ink-950 px-1.5 py-0.5 text-ink-950">Projection</span>
            {artifact.status} · {artifact.model_version} · {artifact.horizon_years}y
          </p>
          <h2 className="mt-2 font-serif text-3xl text-ink-950">{artifact.title}</h2>
          {artifact.ministry ? (
            <p className="mt-1 text-sm text-ink-500">
              Baseline from ·{" "}
              <Link
                to="/admin/countries/$code/portfolio/$ministry"
                params={{ code, ministry: artifact.ministry.slug }}
                className="underline underline-offset-2 hover:text-ink-950"
              >
                {artifact.ministry.name}
              </Link>{" "}
              <span className="text-ink-500/70">(Chamber 02)</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-500">
              Baseline from ·{" "}
              <Link
                to="/admin/countries/$code/portfolio"
                params={{ code }}
                className="underline underline-offset-2 hover:text-ink-950"
              >
                {code} cabinet
              </Link>{" "}
              <span className="text-ink-500/70">(Chamber 02)</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={togglePin}
            className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
          >
            {pinned ? <PinOff size={12} /> : <Pin size={12} />}
            {pinned ? "Unpin" : "Pin"}
          </button>
          <Link
            to="/admin/countries/$code/scenarios/new"
            params={{ code }}
            search={{ fork: id }}
            className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
          >
            <GitFork size={12} /> Fork
          </Link>
          <button
            onClick={() =>
              navigator.clipboard.writeText(window.location.href).catch(() => {})
            }
            className="inline-flex items-center gap-1.5 border border-line-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700 hover:border-ink-950 hover:text-ink-950"
          >
            <Copy size={12} /> Copy link
          </button>
          {artifact.status === "draft" && (
            <button
              onClick={() => promote.mutate("shared")}
              disabled={promote.isPending}
              className="border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              Share
            </button>
          )}
          {artifact.status === "shared" && (
            <button
              onClick={() => promote.mutate("adopted")}
              disabled={promote.isPending}
              className="border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:bg-ink-700 disabled:opacity-50"
            >
              Adopt
            </button>
          )}
        </div>
      </header>

      {assumptionsNote && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-700">{assumptionsNote}</p>
      )}

      {!hasResults ? (
        <p className="mt-8 border border-line-200 p-6 text-sm text-ink-500">
          No engine output snapshot found on this artifact.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Projected GDP growth · P10 / P50 / P90
            </h3>
            <div className="mt-3">
              <GdpFanChart years={results.years} path={results.gdpGrowthPath} />
            </div>
          </section>

          <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Sector waterfall (Δ pp)
              </h3>
              <div className="mt-3">
                <SectorWaterfall impacts={results.sectorImpacts} />
              </div>
            </div>
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                Attribution — lever contribution
              </h3>
              <div className="mt-3">
                <AttributionStack items={results.attribution} />
              </div>
            </div>
          </section>

          <section className="mt-10">
            <NarrativePanel
              initial={narrativeMd}
              payload={{ scenarioId: id }}
              onGenerated={() => navigate({ to: ".", replace: true })}
            />
          </section>
        </>
      )}

      {artifact.promotions.length > 0 && (
        <section className="mt-10">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Promotion log
          </h3>
          <ul className="mt-3 divide-y divide-line-200 border-t border-line-200 text-xs">
            {artifact.promotions.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>
                  {p.from_status} → <span className="font-medium">{p.to_status}</span>
                </span>
                <span className="font-mono text-ink-500">
                  {new Date(p.created_at).toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
