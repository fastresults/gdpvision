import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LayoutGrid, Rows3, Printer } from "lucide-react";

import { getExecutiveDashboard } from "@/lib/executive/dashboard.functions";
import { rankAttention } from "@/lib/executive/attention";

import { PrincipalMasthead } from "./PrincipalMasthead";
import { AttentionRail } from "./AttentionRail";
import { ChamberCard } from "./ChamberCard";
import { ChamberLedgerTable } from "./ChamberLedgerTable";
import { DueLedger } from "./DueLedger";

export function executiveQuery(code: string) {
  return queryOptions({
    queryKey: ["executive", "dashboard", code],
    queryFn: () => getExecutiveDashboard({ data: { country_code: code } }),
    staleTime: 60_000,
  });
}

export function ExecutiveSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-24 border-b border-line-200" />
      <div className="h-40 border-y border-line-200" />
      <div className="grid grid-cols-1 border-t border-line-200 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[228px] border-b border-r border-line-200 bg-paper-100/40" />
        ))}
      </div>
    </div>
  );
}

export function ExecutiveDashboard({
  code,
  principal = "Prime Minister",
}: {
  code: string;
  principal?: string;
}) {
  const { data } = useSuspenseQuery(executiveQuery(code));
  const [view, setView] = useState<"grid" | "ledger">("grid");
  const attention = useMemo(() => rankAttention(data.chambers), [data.chambers]);

  return (
    <div className="executive-brief space-y-6">
      <PrincipalMasthead masthead={data.masthead} principal={principal} />

      <AttentionRail code={code} items={attention} />

      <section>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 pb-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-950">The eight chambers</h2>
          <div className="flex shrink-0 items-center gap-1 print:hidden">
            <ViewToggle active={view === "grid"} onClick={() => setView("grid")} label="Grid">
              <LayoutGrid size={12} strokeWidth={1.5} />
            </ViewToggle>
            <ViewToggle active={view === "ledger"} onClick={() => setView("ledger")} label="Ledger">
              <Rows3 size={12} strokeWidth={1.5} />
            </ViewToggle>
            <button
              type="button"
              onClick={() => window.print()}
              className="ml-2 inline-flex items-center gap-1.5 border border-line-200 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500 transition-colors hover:border-ink-950 hover:text-ink-950"
            >
              <Printer size={12} strokeWidth={1.5} /> Brief
            </button>
          </div>
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-1 border-l border-t border-line-200 sm:grid-cols-2 lg:grid-cols-4">
            {data.chambers.map((c, i) => (
              <ChamberCard key={c.index} code={code} chamber={c} index={i} />
            ))}
          </div>
        ) : (
          <ChamberLedgerTable code={code} chambers={data.chambers} />
        )}
      </section>

      <DueLedger code={code} chambers={data.chambers} />

      <p className="pt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-300">
        Assembled {new Date(data.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ·
        live from the corpus
      </p>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors ${
        active ? "border-ink-950 text-ink-950" : "border-line-200 text-ink-500 hover:text-ink-950"
      }`}
    >
      {children}
      {label}
    </button>
  );
}
