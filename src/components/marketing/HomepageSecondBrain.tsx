import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { BrainConstellation, type BrainFilter } from "@/components/country-data/BrainConstellation";
import { getCountryBrainShape } from "@/lib/present/corpus-snapshot.functions";
import { DEMO_COUNTRY } from "@/lib/present/chambers";

/** Public shape only: never request the protected memory-title query here. */
export function HomepageSecondBrain() {
  const [filter, setFilter] = useState<BrainFilter>({ country: DEMO_COUNTRY });
  const shape = useQuery({
    queryKey: ["present", "brain-shape", DEMO_COUNTRY],
    queryFn: () => getCountryBrainShape({ data: { country: DEMO_COUNTRY } }),
    staleTime: 10 * 60_000,
  });
  const rows = shape.data ?? [];

  return (
    <div className="min-w-0" data-homepage-brain>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-line-200 pb-4">
        <h3 className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-ink-700">
          Antigua &amp; Barbuda · Live Second Brain
        </h3>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase text-ink-500">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-positive" aria-hidden />
          Live example
        </span>
      </div>
      {rows.length > 0 ? (
        <BrainConstellation
          rows={rows}
          mode="single"
          centerLabel={DEMO_COUNTRY}
          filter={filter}
          onFilter={(next) => setFilter({ ...next, country: DEMO_COUNTRY })}
          publicView
        />
      ) : (
        <div className="flex aspect-square flex-col items-center justify-center gap-4 border border-line-200 bg-paper-50 px-6 text-center" role="status">
          <p className="text-[15px] text-ink-700">
            {shape.isPending ? "Loading Antigua’s Second Brain…" : "Antigua’s live evidence view is currently unavailable."}
          </p>
          {!shape.isPending && (
            <button type="button" className="btn-secondary" disabled={shape.isFetching} onClick={() => void shape.refetch()}>
              <RefreshCw size={14} className={shape.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />
              {shape.isFetching ? "Retrying…" : "Try again"}
            </button>
          )}
        </div>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-ink-500">
        A live view of Antigua’s evidence, organised by sector. Protected record titles and contents are not shown.
      </p>
    </div>
  );
}