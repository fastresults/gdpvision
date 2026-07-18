import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PlusCircle, Sparkles, ChevronRight, Activity, AlertTriangle, ShieldAlert, Zap, HelpCircle, Landmark } from "lucide-react";
import { getDecisionQueue, addSignalToAgenda, createCabinetSession, type DecisionCard, type RoomOverview } from "@/lib/cabinet.functions";
import { ImpactBar } from "./primitives";

export function decisionQueueQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet","queue", code],
    queryFn: () => getDecisionQueue({ data: { countryCode: code } }),
  });
}

const KIND_ICON: Record<DecisionCard["kind"], React.ReactNode> = {
  narrative: <Activity size={12} />,
  grade: <AlertTriangle size={12} />,
  strategy: <ShieldAlert size={12} />,
  scenario: <Sparkles size={12} />,
  threat: <Zap size={12} />,
  dossier_question: <HelpCircle size={12} />,
};

export function DecisionQueue({ code, overview }: { code: string; overview: RoomOverview }) {
  const { data } = useSuspenseQuery(decisionQueueQuery(code));
  const qc = useQueryClient();
  const add = useServerFn(addSignalToAgenda);
  const create = useServerFn(createCabinetSession);

  const addMut = useMutation({
    mutationFn: async (card: DecisionCard) => {
      let sid = overview.nextSession?.id;
      if (!sid) {
        const { id } = await create({ data: {
          countryCode: code,
          title: `Cabinet — ${new Date().toLocaleDateString()}`,
          scheduledFor: new Date(Date.now() + 7 * 86400000).toISOString(),
          classification: "restricted",
        }});
        sid = id;
      }
      return add({ data: {
        countryCode: code, sessionId: sid,
        signal: {
          kind: card.kind === "threat" || card.kind === "dossier_question" ? "narrative" : card.kind,
          id: card.refId, title: card.title, meta: card.hint,
        },
      }});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cabinet"] }),
  });

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">What needs a decision</div>
          <h2 className="font-serif text-2xl">Cabinet queue · ranked by impact × urgency</h2>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{data.length} items</div>
      </header>
      {data.length === 0 ? (
        <p className="border border-line-200 bg-paper-0 p-8 text-center text-sm text-ink-500">
          No pending signals — enjoy the calm.
        </p>
      ) : (
        <ul className="divide-y divide-line-200 border border-line-200 bg-paper-0">
          {data.slice(0, 8).map((c) => (
            <li key={c.key} className="grid grid-cols-[auto,1fr,auto] items-start gap-4 p-4">
              <span className="grid h-9 w-9 place-items-center border border-line-200 text-ink-950">{KIND_ICON[c.kind]}</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  {c.priority && (
                    <span className={`font-mono text-[9px] uppercase tracking-[0.2em] ${c.priority === "P1" ? "text-red-600" : c.priority === "P2" ? "text-gold-700" : "text-ink-500"}`}>
                      {c.priority}
                    </span>
                  )}
                  <div className="truncate text-sm font-medium text-ink-950">{c.title}</div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                  <span className="inline-flex items-center gap-1"><Landmark size={10} />{c.sponsorMinistryName ?? "Unassigned sponsor"}</span>
                  {c.sectorCode && <span className="font-mono uppercase tracking-[0.18em]">{c.sectorCode}</span>}
                  <span className="opacity-70">· {c.hint}</span>
                </div>
                <div className="mt-2">
                  <ImpactBar impact={c.impact} confidence={c.confidence} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 tabular-nums">score {c.score}</div>
                <button
                  disabled={addMut.isPending}
                  onClick={() => addMut.mutate(c)}
                  className="inline-flex items-center gap-1 border border-ink-950 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 hover:bg-ink-950 hover:text-paper-0 disabled:opacity-40"
                >
                  <PlusCircle size={11} /> Agenda <ChevronRight size={11} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
