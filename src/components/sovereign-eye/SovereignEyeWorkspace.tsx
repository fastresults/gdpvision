import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Clipboard, Save, Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Explain } from "@/components/explain/Explain";
import {
  generateSovereignEyeBrief,
  getSovereignEyeWorkspace,
  saveSovereignEyeScene,
  type SovereignEyeScene,
  type SovereignEyeWorkspaceData,
} from "@/lib/sovereign-eye.functions";

import "@/lib/explain/sovereign-eye-entries";
import { EvidencePanel } from "./EvidencePanel";
import { LayerRail } from "./LayerRail";
import { RegionMap, type MapFeature } from "./RegionMap";

export const sovereignEyeQuery = (code: string) =>
  queryOptions<SovereignEyeWorkspaceData>({
    queryKey: ["sovereign-eye", code, "workspace"],
    queryFn: () => getSovereignEyeWorkspace({ data: { countryCode: code } }),
    staleTime: 60_000,
  });

function shareUrl(scene: SovereignEyeScene) {
  if (!scene.shareToken || typeof window === "undefined") return null;
  return `${window.location.origin}/s/${scene.shareToken}`;
}

export function SovereignEyeWorkspace({ code }: { code: string }) {
  const { data } = useSuspenseQuery(sovereignEyeQuery(code));
  const qc = useQueryClient();
  const briefFn = useServerFn(generateSovereignEyeBrief);
  const saveSceneFn = useServerFn(saveSovereignEyeScene);
  const [focusedLayerId, setFocusedLayerId] = useState(data.layers[0]?.id ?? "macro-pulse");
  const [visibleLayerIds, setVisibleLayerIds] = useState(() => data.layers.filter((l) => l.visible).map((l) => l.id));
  const [aiSelectedLayerIds, setAiSelectedLayerIds] = useState(() => data.layers.filter((l) => l.visible).map((l) => l.id));
  const [pinnedFeature, setPinnedFeature] = useState<MapFeature | null>(null);
  const evidenceRef = useRef<HTMLElement>(null);
  const [question, setQuestion] = useState("What needs attention before the next Cabinet discussion?");
  const [brief, setBrief] = useState<{ text: string; generatedAt: string } | null>(null);
  const [sceneTitle, setSceneTitle] = useState(`${data.country.name} sovereign eye`);
  const [sceneVisibility, setSceneVisibility] = useState<"private" | "public">("private");
  const [savedScene, setSavedScene] = useState<SovereignEyeScene | null>(null);

  const visibleLayers = useMemo(
    () => data.layers.filter((layer) => visibleLayerIds.includes(layer.id)),
    [data.layers, visibleLayerIds],
  );

  const briefMut = useMutation({
    mutationFn: () =>
      briefFn({
        data: {
          countryCode: code,
          selectedLayerIds: aiSelectedLayerIds,
          question,
        },
      }),
    onSuccess: (result) => setBrief(result),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      saveSceneFn({
        data: {
          countryCode: code,
          title: sceneTitle,
          description:
            sceneVisibility === "public"
              ? `Shared sovereign intelligence scene for ${data.country.name}.`
              : brief?.text.slice(0, 360) ?? "Saved Sovereign Eye scene.",
           layers: visibleLayers.map((layer) => ({ ...layer, visible: true })),
          camera: {
             focusedLayerId,
             aiSelectedLayerIds,
              pinnedFeature: sceneVisibility === "public" && pinnedFeature?.visibility === "private" ? null : pinnedFeature,
            country: data.country.code,
            generatedAt: data.diagnostics.generatedAt,
             publicSnapshot: sceneVisibility === "public" ? {
               kpis: data.kpis.filter((item) => item.visibility === "public"),
               flows: data.flows.filter((item) => item.visibility === "public"),
               sectors: data.sectors,
               evidence: {
                 sources: data.evidence.sources.filter((item) => item.visibility === "public"),
                 memory: data.evidence.memory.filter((item) => item.visibility === "public"),
               },
               live: data.live,
             } : null,
          },
          notes: sceneVisibility === "public" ? null : brief?.text ?? null,
          visibility: sceneVisibility,
        },
      }),
    onSuccess: (scene: SovereignEyeScene) => {
      setSavedScene(scene);
      qc.invalidateQueries({ queryKey: ["sovereign-eye", code, "workspace"] });
    },
  });

  function toggleAiLayer(id: string) {
    setAiSelectedLayerIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleVisibleLayer(id: string) {
    setVisibleLayerIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setPinnedFeature(null);
  }

  function restoreScene(scene: SovereignEyeScene) {
    const camera = scene.camera && typeof scene.camera === "object" && !Array.isArray(scene.camera)
      ? scene.camera as Record<string, unknown>
      : {};
    const restoredAiIds = Array.isArray(camera.aiSelectedLayerIds)
      ? camera.aiSelectedLayerIds.filter((id): id is string => typeof id === "string")
      : scene.layers.map((layer) => layer.id);
    setVisibleLayerIds(scene.layers.filter((layer) => layer.visible).map((layer) => layer.id));
    setAiSelectedLayerIds(restoredAiIds);
    setFocusedLayerId(typeof camera.focusedLayerId === "string" ? camera.focusedLayerId : scene.layers[0]?.id ?? "macro-pulse");
    const restoredPin = camera.pinnedFeature;
    setPinnedFeature(
      restoredPin && typeof restoredPin === "object" && !Array.isArray(restoredPin) &&
      typeof (restoredPin as Record<string, unknown>).signal === "string"
        ? restoredPin as MapFeature
        : null,
    );
    setSceneTitle(scene.title);
    setSceneVisibility(scene.visibility);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <header className="grid gap-5 border-b border-line-200 pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">Sovereign Eye</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-ink-950">{data.country.name} live intelligence map</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-600">
            Country corpus, capital flows, ministerial coverage and no-key public live feeds in one evidence-separated map room.
          </p>
        </div>
        <div className="grid grid-cols-3 border border-line-200 bg-card text-center">
          <Metric label="Layers" value={data.layers.length} />
          <Metric label="Sources" value={data.evidence.sources.length} />
          <Metric label="Scenes" value={data.scenes.length} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <LayerRail
          layers={data.layers}
           focusedLayerId={focusedLayerId}
           visibleIds={visibleLayerIds}
           aiSelectedIds={aiSelectedLayerIds}
           onFocus={(id) => { setFocusedLayerId(id); setPinnedFeature(null); }}
           onToggleVisible={toggleVisibleLayer}
           onToggleAi={toggleAiLayer}
           onShowAll={() => setVisibleLayerIds(data.layers.map((layer) => layer.id))}
           onClear={() => { setVisibleLayerIds([]); setPinnedFeature(null); }}
        />
        <RegionMap
          code={data.country.code}
          countryName={data.country.name}
           layers={data.layers.map((layer) => ({ ...layer, visible: visibleLayerIds.includes(layer.id) }))}
          flows={data.flows}
           kpis={data.kpis}
           sectors={data.sectors}
           evidence={data.evidence}
           live={data.live}
           focusedLayerId={focusedLayerId}
           pinnedFeature={pinnedFeature}
           onPin={setPinnedFeature}
           onEvidence={() => evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border border-line-200 bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">AI operator</p>
              <h2 className="mt-1 font-serif text-2xl text-ink-950">Brief the active map</h2>
            </div>
            <Explain id="sovereign-eye.ai-brief" mark={false}>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">How it works</span>
            </Explain>
          </div>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="mt-4 min-h-24 w-full resize-y border border-line-200 bg-paper-0 p-3 text-sm text-ink-950 outline-none focus:border-ink-950"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
               disabled={briefMut.isPending || aiSelectedLayerIds.length === 0}
              onClick={() => briefMut.mutate()}
              className="btn-primary min-h-10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
            >
              <Bot size={15} strokeWidth={1.5} />
              {briefMut.isPending ? "Reading map" : "Prepare AI brief"}
            </button>
             <p className="text-xs text-ink-500">{aiSelectedLayerIds.length} layer{aiSelectedLayerIds.length === 1 ? "" : "s"} selected for the brief</p>
          </div>
          {briefMut.error ? <p className="mt-3 text-sm text-signal-negative">{briefMut.error.message}</p> : null}
          {brief ? (
            <article className="mt-5 whitespace-pre-wrap border border-line-200 bg-paper-50 p-4 text-sm leading-relaxed text-ink-800">
              {brief.text}
            </article>
          ) : null}
        </div>

        <div className="border border-line-200 bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Scenes</p>
          <h2 className="mt-1 font-serif text-2xl text-ink-950">Save and share</h2>
          <label className="mt-4 block text-xs font-mono uppercase tracking-[0.16em] text-ink-500" htmlFor="scene-title">Scene title</label>
          <input
            id="scene-title"
            value={sceneTitle}
            onChange={(event) => setSceneTitle(event.target.value)}
            className="mt-2 h-10 w-full border border-line-200 bg-paper-0 px-3 text-sm text-ink-950 outline-none focus:border-ink-950"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSceneVisibility("private")}
              className={`${sceneVisibility === "private" ? "btn-primary" : "btn-secondary"} min-h-10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]`}
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => setSceneVisibility("public")}
               disabled={visibleLayers.some((layer) => layer.visibility.private > 0)}
              className={`${sceneVisibility === "public" ? "btn-primary" : "btn-secondary"} min-h-10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]`}
            >
              Public link
            </button>
          </div>
           {visibleLayers.some((layer) => layer.visibility.private > 0) ? (
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              Public links require layers containing public evidence only.
            </p>
          ) : null}
          <button
            type="button"
             disabled={saveMut.isPending || visibleLayers.length === 0 || sceneTitle.trim().length < 2}
            onClick={() => saveMut.mutate()}
            className="btn-accent mt-3 min-h-10 w-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
          >
            <Save size={15} strokeWidth={1.5} />
            {saveMut.isPending ? "Saving" : "Save scene"}
          </button>
          {saveMut.error ? <p className="mt-3 text-sm text-signal-negative">{saveMut.error.message}</p> : null}
          {savedScene ? <SavedScene scene={savedScene} /> : null}
          <ul className="mt-5 space-y-2">
             {data.scenes.map((scene) => (
              <li key={scene.id} className="border border-line-200 p-3">
                 <div className="flex items-start justify-between gap-3">
                   <p className="font-serif text-base text-ink-950">{scene.title}</p>
                   <button type="button" onClick={() => restoreScene(scene)} className="btn-ghost min-h-8 px-2 text-[9px]">Open scene</button>
                 </div>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                  {scene.visibility} · {new Date(scene.updatedAt).toLocaleDateString()}
                </p>
              </li>
            ))}
            {data.scenes.length === 0 && <li className="text-sm text-ink-500">No scenes saved yet.</li>}
          </ul>
        </div>
      </section>

      <section className="grid gap-3 border border-line-200 bg-card p-5 md:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Weather</p>
          <p className="mt-2 text-sm text-ink-700">{data.live.weather.summary}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Seismic</p>
          <p className="mt-2 text-sm text-ink-700">{data.live.earthquakes.summary}</p>
        </div>
        <div>
          <Explain id="sovereign-eye.live-feeds" mark={false}>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Live-feed method</span>
          </Explain>
          <p className="mt-2 text-sm text-ink-700">Checked {new Date(data.live.checkedAt).toLocaleString()}</p>
        </div>
      </section>

       <section ref={evidenceRef} className="scroll-mt-6">
         <EvidencePanel kpis={data.kpis} sectors={data.sectors} flows={data.flows} evidence={data.evidence} />
       </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-line-200 px-5 py-3 last:border-r-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-2xl text-ink-950" data-numeric>{value.toFixed(2)}</p>
    </div>
  );
}

function SavedScene({ scene }: { scene: SovereignEyeScene }) {
  const url = shareUrl(scene);
  return (
    <div className="mt-4 border border-line-200 bg-paper-50 p-3 text-sm text-ink-700">
      <p className="font-serif text-base text-ink-950">Saved: {scene.title}</p>
      {url ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="btn-secondary min-h-9 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]">
            <Share2 size={14} strokeWidth={1.5} />
            Open public link
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(url)}
            className="btn-ghost min-h-9 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
          >
            <Clipboard size={14} strokeWidth={1.5} />
            Copy
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-500">Private scenes stay inside the country workspace.</p>
      )}
    </div>
  );
}