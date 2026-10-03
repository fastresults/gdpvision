import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { MICRO } from "@/components/personas/portfolio/labels";
import { MinistryMapping } from "@/components/personas/portfolio/MinistryMapping";
import { PortfolioBoard } from "@/components/personas/portfolio/PortfolioBoard";
import { createPortfolioSet, getPortfolioBoard } from "@/lib/personas/portfolio/studio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/portfolios/")({
  head: ({ params }) => ({
    meta: [
      { title: `Ideal Ministers · ${params.code} — GDPVision` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortfoliosPage,
});

function PortfoliosPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchBoard = useServerFn(getPortfolioBoard);
  const create = useServerFn(createPortfolioSet);
  const key = ["portfolio-board", code];
  const q = useQuery({ queryKey: key, queryFn: () => fetchBoard({ data: { code } }) });
  const [tab, setTab] = useState<"board" | "mapping">("board");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = q.data;

  async function onCreate(portfolio: string, scope: "regional" | "country") {
    setBusy(`${portfolio}:${scope}`);
    setError(null);
    try {
      const r = await create({ data: { code, portfolio, scope, targetSize: 50 } });
      await qc.invalidateQueries({ queryKey: key });
      void navigate({
        to: "/admin/countries/$code/personas/portfolios/$setId",
        params: { code, setId: r.id },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className={MICRO}>{code} · Chamber 07 · Ministers</div>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-ink-950">The Ideal Minister</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-700">
          For every portfolio — and for the Prime Minister — the Lab casts 50 composite ministers
          grounded in the region's real office holders, ministry mandates and cited research; scores
          each against one skill taxonomy; counts what the cast has in common; and synthesises the
          Ideal Minister: personality, values, how they decide each class of decision the office
          faces, and the skills it demands. Regional profiles are approved once and re-weighted for{" "}
          {data?.countryName ?? code} by a country overlay.
        </p>
        <p className="mt-2 max-w-3xl border-l-2 border-line-200 pl-3 text-[12px] text-ink-500">
          Personas are composites, never portraits of real people. A profile is a standard to
          recruit, develop and rehearse against — not an assessment of any office holder.
        </p>
      </div>

      <div className="mb-5 flex gap-4 border-b border-line-200">
        {(
          [
            ["board", "Portfolios"],
            ["mapping", `${data?.countryName ?? code}'s ministries`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "btn-ghost -mb-px border-b-2 px-1 pb-2 text-sm",
              tab === k ? "border-ink-950 text-ink-950" : "border-transparent text-ink-500",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {q.isLoading && <div className="h-24 animate-pulse bg-paper-50" aria-busy="true" />}
      {q.error && (
        <div className="border-l-2 border-signal-negative py-2 pl-4">
          <p className="text-sm text-signal-negative">{(q.error as Error).message}</p>
          <button
            type="button"
            className="btn-ghost -ml-2 mt-2 px-2 py-1 text-xs"
            onClick={() => q.refetch()}
          >
            Try again
          </button>
        </div>
      )}
      {error && (
        <p className="mb-4 border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
          {error}
        </p>
      )}
      {data && !data.aiAvailable && (
        <p className="mb-4 border-l-2 border-signal-caution py-2 pl-4 text-sm text-ink-700">
          Running is unavailable on this server (the AI gateway key is not configured).
        </p>
      )}
      {data && data.aiAvailable && !data.researchAvailable && (
        <p className="mb-4 border-l-2 border-signal-caution py-2 pl-4 text-sm text-ink-700">
          The cited research pass is off (PERPLEXITY_API_KEY is not configured). Profiles will be
          grounded in the corpus alone; the gap is recorded on each run.
        </p>
      )}

      {data && tab === "board" && (
        <PortfolioBoard code={code} data={data} busy={busy} onCreate={onCreate} />
      )}
      {data && tab === "mapping" && (
        <MinistryMapping
          data={data}
          onChanged={() => void qc.invalidateQueries({ queryKey: key })}
        />
      )}
    </div>
  );
}
