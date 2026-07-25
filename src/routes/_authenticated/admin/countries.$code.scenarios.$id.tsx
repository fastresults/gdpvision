import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, GitFork, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";

import {
  getScenario,
  promoteScenario,
  runScenarioEngine,
  saveScenario,
  type EngineRunResult,
  type ScenarioArtifact,
} from "@/lib/scenarios.functions";
import type { EngineOutput } from "@/lib/engine/v1_macro";
import { GdpFanChart } from "@/components/scenarios/GdpFanChart";
import { SectorWaterfall } from "@/components/scenarios/SectorWaterfall";
import { AttributionStack } from "@/components/scenarios/AttributionStack";
import { StoryPanel } from "@/components/scenarios/v3/StoryPanel";
import { AdjustSheet } from "@/components/scenarios/v3/AdjustSheet";
import { ScenarioActionBar } from "@/components/scenarios/v3/ScenarioActionBar";
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
  const { data, refetch } = useSuspenseQuery(scenarioQuery(id));
  const artifact: ScenarioArtifact = data;
  const results = (artifact.results ?? {}) as EngineOutput | Record<string, never>;
  const hasResults = "years" in results;

  // Hydrate lever defs (for the AdjustSheet). Cheap: server fn is cached by
  // country + horizon + levers key.
  const engineInitQ = useQuery({
    queryKey: ["scenario-engine-init", code, artifact.horizon_years, id],
    queryFn: () =>
      runScenarioEngine({
        data: {
          countryCode: code,
          horizonYears: artifact.horizon_years,
          levers: artifact.lever_settings,
        },
      }),
    staleTime: 5 * 60_000,
    enabled: hasResults,
  });

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
    onSuccess: () => refetch(),
  });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [analystOpen, setAnalystOpen] = useState(false);
  const [preview, setPreview] = useState<EngineRunResult | null>(null);

  const displayed: EngineOutput | null = useMemo(() => {
    if (preview) return preview.output;
    if (hasResults) return results as EngineOutput;
    return null;
  }, [preview, results, hasResults]);

  const question = String(
    (artifact.assumptions?.question_text as string | undefined) ?? artifact.title,
  );
  const thesis =
    typeof artifact.assumptions?.thesis === "string"
      ? (artifact.assumptions.thesis as string)
      : undefined;
  const citations = Array.isArray(artifact.assumptions?.citations)
    ? (artifact.assumptions.citations as Array<{ label: string; kind: string; ref?: string }>)
    : undefined;

  const saveNewVersion = useMutation({
    mutationFn: (levers: Record<string, number>) =>
      saveScenario({
        data: {
          countryCode: code,
          ministrySlug: artifact.ministry?.slug ?? null,
          sectorCode: artifact.sector_code,
          title: `${artifact.title} (adjusted)`,
          horizonYears: artifact.horizon_years,
          levers,
          assumptions: {
            question_text: question,
            thesis: thesis ?? "",
            source: "adjust_v3",
            parent_scenario: id,
          },
        },
      }),
    onSuccess: async (res) => {
      toast.success("Saved as new version");
      setAdjustOpen(false);
      setPreview(null);
      await navigate({
        to: "/admin/countries/$code/scenarios/$id",
        params: { code, id: res.id },
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link
            to="/admin/countries/$code/scenarios"
            params={{ code }}
            className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500 hover:text-ink-950"
          >
            ← Ask another question
          </Link>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {artifact.status} · {artifact.horizon_years}y · {artifact.model_version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={togglePin} className="btn-ghost inline-flex items-center gap-1.5">
            {pinned ? <PinOff size={12} /> : <Pin size={12} />}
            {pinned ? "Unpin" : "Pin"}
          </button>
          <Link
            to="/admin/countries/$code/scenarios/new"
            params={{ code }}
            search={{ fork: id }}
            className="btn-ghost inline-flex items-center gap-1.5"
          >
            <GitFork size={12} /> Fork in workbench
          </Link>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href).catch(() => {})}
            className="btn-ghost inline-flex items-center gap-1.5"
          >
            <Copy size={12} /> Copy link
          </button>
        </div>
      </div>

      {!hasResults ? (
        <p className="mt-8 border border-line-200 p-6 text-sm text-ink-500">
          No engine output snapshot found on this artifact.
        </p>
      ) : (
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <StoryPanel
              scenarioId={id}
              question={question}
              fallbackThesis={thesis}
              citations={citations}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="border border-line-200 bg-paper-50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                Projected GDP growth
              </p>
              <p className="mt-0.5 text-[11px] text-ink-500">
                Shaded band = worst plausible ↔ best plausible
              </p>
              <div className="mt-3">
                {displayed && (
                  <GdpFanChart
                    years={displayed.years}
                    path={displayed.gdpGrowthPath}
                    ghostPath={
                      preview && hasResults ? (results as EngineOutput).gdpGrowthPath : undefined
                    }
                  />
                )}
              </div>
            </div>

            <div className="mt-6 border border-line-200 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                Biggest sector shifts
              </p>
              <div className="mt-3">
                {displayed && <SectorWaterfall impacts={displayed.sectorImpacts} />}
              </div>
            </div>
          </div>
        </section>
      )}

      {hasResults && displayed && (
        <section className="mt-10 border-t border-line-200 pt-6">
          <button
            type="button"
            onClick={() => setAnalystOpen((v) => !v)}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500 hover:text-ink-950"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${analystOpen ? "rotate-180" : ""}`}
            />
            Analyst view — what drove the change
          </button>
          {analystOpen && (
            <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  What drove the change
                </p>
                <div className="mt-3">
                  <AttributionStack items={displayed.attribution} />
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  All sector movement
                </p>
                <div className="mt-3">
                  <SectorWaterfall impacts={displayed.sectorImpacts} />
                </div>
                <div className="mt-4">
                  <Link
                    to="/admin/countries/$code/scenarios/new"
                    params={{ code }}
                    search={{ fork: id }}
                    className="btn-ghost inline-flex items-center gap-1.5 text-[11px]"
                  >
                    Open full workbench →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {artifact.status === "draft" && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => promote.mutate("shared")}
            disabled={promote.isPending}
            className="btn-secondary"
          >
            Share with Cabinet
          </button>
        </div>
      )}

      <ScenarioActionBar
        onAdjust={() => {
          if (!engineInitQ.data) {
            toast.info("Warming the engine…");
            return;
          }
          setAdjustOpen(true);
        }}
        onCompare={() =>
          navigate({ to: "/admin/countries/$code/scenarios/compare", params: { code } })
        }
        onSendCabinet={() => {
          navigator.clipboard.writeText(window.location.href).catch(() => {});
          toast.success("Link copied — paste into Cabinet session");
          navigate({ to: "/admin/countries/$code/cabinet", params: { code } });
        }}
        onSendNarrative={() => {
          navigator.clipboard.writeText(window.location.href).catch(() => {});
          toast.success("Link copied — paste into Narrative brief");
          navigate({ to: "/admin/countries/$code/narrative", params: { code } });
        }}
      />

      {engineInitQ.data && (
        <AdjustSheet
          open={adjustOpen}
          onClose={() => {
            setAdjustOpen(false);
            setPreview(null);
          }}
          engineInit={engineInitQ.data}
          currentLevers={artifact.lever_settings}
          horizonYears={artifact.horizon_years}
          onPreview={(_, res) => setPreview(res)}
          onCommit={(levers) => saveNewVersion.mutateAsync(levers).then(() => undefined)}
          showAllHref={`/admin/countries/${code}/scenarios/new?fork=${id}`}
        />
      )}
    </div>
  );
}
