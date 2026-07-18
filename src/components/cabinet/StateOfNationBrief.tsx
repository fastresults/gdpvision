import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Sparkles } from "lucide-react";
import { CitedMarkdown } from "@/components/citations/CitedMarkdown";
import { getSituationBrief, generateSituationBrief, type SituationBrief } from "@/lib/cabinet.functions";

export function briefQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet", "brief", code],
    queryFn: () => getSituationBrief({ data: { countryCode: code } }),
  });
}

export function StateOfNationBrief({ code, onPosture }: { code: string; onPosture: (p: Record<string, string>) => void }) {
  const { data: brief } = useSuspenseQuery(briefQuery(code));
  const qc = useQueryClient();
  const gen = useServerFn(generateSituationBrief);
  const genMut = useMutation({
    mutationFn: () => gen({ data: { countryCode: code } }),
    onSuccess: (b: SituationBrief) => {
      onPosture(b.posture);
      qc.setQueryData(briefQuery(code).queryKey, b);
    },
  });

  const citations = (brief?.citations ?? []).map((c) => ({
    url: c.href,
    title: c.label,
    org: c.kind,
    label: c.label,
  }));

  return (
    <section className="border border-line-200 bg-paper-0 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
            <Sparkles size={11} className="mr-1 inline-block" /> State of the Nation · Pyramid brief
          </div>
          <h2 className="mt-1 font-serif text-2xl">{brief?.headline || "Cabinet Situation Brief"}</h2>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {brief?.generatedAt
              ? `Generated ${new Date(brief.generatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${brief.model ? " · " + brief.model : ""}`
              : "No brief yet — generate one from your live corpus."}
          </div>
        </div>
        <button
          disabled={genMut.isPending}
          onClick={() => genMut.mutate()}
          className="inline-flex items-center gap-1.5 border border-ink-950 bg-ink-950 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-0 hover:opacity-90 disabled:opacity-40"
        >
          <RefreshCw size={12} className={genMut.isPending ? "animate-spin" : ""} />
          {genMut.isPending ? "Drafting…" : brief ? "Regenerate" : "Generate brief"}
        </button>
      </div>

      <div className="prose prose-sm mt-6 max-w-none">
        {brief ? (
          <CitedMarkdown source={brief.briefMd} citations={citations} />
        ) : (
          <p className="text-sm text-ink-500">
            The Cabinet brief is generated from your live KPIs, sector composition, narrative signals, FDI threats, grade alerts and open commitments —
            grounded with citations. Click <em>Generate brief</em> to draft it.
          </p>
        )}
      </div>
    </section>
  );
}
