import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Timer, CheckCircle2, Plus, Trash2, FlagOff } from "lucide-react";

import {
  getSession, recordAgendaOutcome, closeSession, type AgendaItem, type MotionKind,
} from "@/lib/cabinet.functions";

function sessionQuery(sid: string) {
  return queryOptions({
    queryKey: ["cabinet","session", sid],
    queryFn: () => getSession({ data: { sessionId: sid } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/cabinet/session/$sid")({
  head: ({ params }) => ({ meta: [{ title: `Session Mode · ${params.code} — GDPVision` }, { name: "robots", content: "noindex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sessionQuery(params.sid)),
  errorComponent: ({ error }) => (<div className="min-h-dvh grid place-items-center bg-ink-950 p-8 text-paper-0"><p>{error.message}</p></div>),
  component: SessionMode,
});

function SessionMode() {
  const { code, sid } = Route.useParams();
  const { data } = useSuspenseQuery(sessionQuery(sid));
  const nav = useNavigate();
  const qc = useQueryClient();
  const [idx, setIdx] = useState(0);
  const items = data.items;
  const current = items[idx];

  const [startedAt] = useState<Record<string, number>>({});
  useEffect(() => { if (current && !startedAt[current.id]) startedAt[current.id] = Date.now(); }, [current, startedAt]);

  const record = useServerFn(recordAgendaOutcome);
  const closeFn = useServerFn(closeSession);

  type RecordPayload = Parameters<CapturePanelProps["onRecord"]>[0];
  const recordMut = useMutation({
    mutationFn: (v: RecordPayload) => record({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cabinet"] }),
  });
  const closeMut = useMutation({
    mutationFn: (chairName: string) => closeFn({ data: { sessionId: sid, chairName } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cabinet"] });
      nav({ to: "/admin/countries/$code/cabinet/minutes/$sid", params: { code, sid } });
    },
  });

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink-950 text-paper-0">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <Link to="/admin/countries/$code/cabinet/agenda/$sid" params={{ code, sid }}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white">
          <X size={14} /> Exit
        </Link>
        <div className="text-center">
          <div className="font-serif text-lg">{data.session?.title}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
            {data.session?.classification} · {items.length} items
          </div>
        </div>
        <button onClick={() => {
          const chair = window.prompt("Chair signing off — chair name:", "");
          if (chair) closeMut.mutate(chair);
        }}
          className="inline-flex items-center gap-2 border border-white/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-ink-950">
          <FlagOff size={12} /> Close session
        </button>
      </div>

      {/* progress */}
      <div className="flex gap-1 border-b border-white/10 px-6 py-2">
        {items.map((it, i) => (
          <button key={it.id} onClick={() => setIdx(i)} title={it.title}
            className={`h-1.5 flex-1 rounded-full transition ${
              i === idx ? "bg-gold-500" : it.status === "decided" ? "bg-emerald-500/70" : "bg-white/15 hover:bg-white/30"
            }`} />
        ))}
      </div>

      {/* body */}
      {current ? (
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-0 lg:grid-cols-[1fr,420px]">
          <SlideView item={current} idx={idx} total={items.length} />
          <CapturePanel key={current.id} item={current} code={code} sid={sid}
            startedAt={startedAt[current.id] ?? Date.now()}
            onRecord={(payload) => recordMut.mutate(payload)}
            saving={recordMut.isPending} />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center">
          <p className="text-white/70">No items on this agenda.</p>
        </div>
      )}

      {/* nav */}
      <div className="flex items-center justify-between border-t border-white/10 px-6 py-3">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] disabled:opacity-30">
          <ChevronLeft size={14} /> Prev
        </button>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 tabular-nums">
          {items.length ? `${idx + 1} / ${items.length}` : "—"}
        </div>
        <button onClick={() => setIdx(Math.min(items.length - 1, idx + 1))} disabled={idx >= items.length - 1}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] disabled:opacity-30">
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function SlideView({ item, idx, total }: { item: AgendaItem; idx: number; total: number }) {
  return (
    <div className="overflow-y-auto p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
          <span>Item {idx + 1} of {total} · {item.classification}</span>
          <span className="inline-flex items-center gap-1"><Timer size={11} /> {item.time_box_min} min</span>
        </div>
        <h1 className="mt-4 font-serif text-4xl leading-tight">{item.title}</h1>
        {item.sponsor_ministry_name && (
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-white/60">Sponsor: {item.sponsor_ministry_name}</div>
        )}
        {item.recommendation && (
          <div className="mt-6 border-l-2 border-gold-500 pl-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">Recommendation</div>
            <p className="mt-1 font-serif text-lg">{item.recommendation}</p>
          </div>
        )}
        {item.brief_md && (
          <div className="mt-8 whitespace-pre-wrap font-serif text-base leading-relaxed text-white/90">{item.brief_md}</div>
        )}
        {item.dossier.length > 0 && (
          <div className="mt-8 border-t border-white/10 pt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">Evidence</div>
            <ol className="mt-2 space-y-1 text-sm text-white/80">
              {item.dossier.map((d, i) => (
                <li key={i}>
                  <span className="mr-2 font-mono text-white/50">[{i+1}]</span>
                  {d.href ? <a href={d.href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-gold-500">{d.label}</a> : d.label}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{d.kind}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function CapturePanel({ item, code, sid, startedAt, onRecord, saving }: {
  item: AgendaItem; code: string; sid: string; startedAt: number;
  onRecord: (v: {
    agendaItemId: string; sessionId: string; countryCode: string;
    decisionTitle: string; decisionBody?: string;
    motionKind: MotionKind; classification: "public"|"internal"|"restricted"|"secret";
    durationSec?: number;
    vote?: { for_count: number; against_count: number; abstain_count: number; notes?: string };
    commitments: Array<{ title: string; ministryId?: string | null; dueAt?: string; successMetric?: string; sectorCode?: string }>;
  }) => void;
  saving: boolean;
}) {
  const [motion, setMotion] = useState<MotionKind>(item.motion_kind);
  const [decisionTitle, setDecisionTitle] = useState(item.recommendation ?? item.title);
  const [decisionBody, setDecisionBody] = useState("");
  const [voteFor, setVoteFor] = useState(0);
  const [voteAgainst, setVoteAgainst] = useState(0);
  const [voteAbstain, setVoteAbstain] = useState(0);
  const [commits, setCommits] = useState<Array<{ title: string; owner: string; dueAt: string; metric: string }>>([]);

  const timer = useLiveDuration(startedAt);

  const alreadyDecided = item.status === "decided";

  return (
    <div className="flex min-h-0 flex-col border-l border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">Capture outcome</div>
        <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 tabular-nums">
          <Timer size={11} /> {formatDuration(timer)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm">
        <label className="block">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Decision title</div>
          <input value={decisionTitle} onChange={(e) => setDecisionTitle(e.target.value)}
            className="mt-1 w-full border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none" />
        </label>
        <label className="mt-3 block">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Motion outcome</div>
          <div className="mt-1 flex gap-1">
            {(["approve","note","refer","defer"] as MotionKind[]).map((v) => (
              <button key={v} onClick={() => setMotion(v)}
                className={`flex-1 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] ${motion === v ? "border-gold-500 bg-gold-500 text-ink-950" : "border-white/20 text-white/70 hover:border-white"}`}>
                {v}
              </button>
            ))}
          </div>
        </label>
        <label className="mt-3 block">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Rationale (optional)</div>
          <textarea value={decisionBody} onChange={(e) => setDecisionBody(e.target.value)} rows={3}
            className="mt-1 w-full border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none" />
        </label>

        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Vote count</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {[["For", voteFor, setVoteFor], ["Against", voteAgainst, setVoteAgainst], ["Abstain", voteAbstain, setVoteAbstain]].map(([label, val, set]) => (
              <label key={label as string} className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/50">{label as string}</span>
                <input type="number" min={0} value={val as number}
                  onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
                  className="mt-1 border border-white/20 bg-transparent px-2 py-1 text-sm tabular-nums text-white focus:border-gold-500 focus:outline-none" />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Commitments spawned</div>
            <button onClick={() => setCommits([...commits, { title: "", owner: "", dueAt: "", metric: "" }])}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white">
              <Plus size={11} /> Add
            </button>
          </div>
          <ul className="mt-1 space-y-2">
            {commits.map((c, i) => (
              <li key={i} className="border border-white/10 p-2">
                <input value={c.title} onChange={(e) => { const cs = [...commits]; cs[i] = { ...cs[i], title: e.target.value }; setCommits(cs); }}
                  placeholder="What needs to happen"
                  className="w-full border-0 bg-transparent px-1 py-0.5 text-sm text-white focus:outline-none" />
                <div className="mt-1 grid grid-cols-[1fr,140px,auto] gap-1">
                  <input value={c.owner} onChange={(e) => { const cs = [...commits]; cs[i] = { ...cs[i], owner: e.target.value }; setCommits(cs); }}
                    placeholder="Owner (name)"
                    className="border border-white/15 bg-transparent px-2 py-1 text-xs text-white focus:outline-none" />
                  <input type="date" value={c.dueAt} onChange={(e) => { const cs = [...commits]; cs[i] = { ...cs[i], dueAt: e.target.value }; setCommits(cs); }}
                    className="border border-white/15 bg-transparent px-2 py-1 text-xs text-white focus:outline-none" />
                  <button onClick={() => setCommits(commits.filter((_, j) => j !== i))} className="text-white/50 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
                <input value={c.metric} onChange={(e) => { const cs = [...commits]; cs[i] = { ...cs[i], metric: e.target.value }; setCommits(cs); }}
                  placeholder="Success metric"
                  className="mt-1 w-full border border-white/15 bg-transparent px-2 py-1 text-xs text-white focus:outline-none" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 p-3">
        <button
          disabled={saving || alreadyDecided || !decisionTitle.trim()}
          onClick={() => onRecord({
            agendaItemId: item.id, sessionId: sid, countryCode: code,
            decisionTitle: decisionTitle.trim(),
            decisionBody: decisionBody || undefined,
            motionKind: motion,
            classification: item.classification,
            durationSec: Math.round((Date.now() - startedAt) / 1000),
            vote: (voteFor || voteAgainst || voteAbstain) ? { for_count: voteFor, against_count: voteAgainst, abstain_count: voteAbstain } : undefined,
            commitments: commits.filter((c) => c.title.trim()).map((c) => ({
              title: c.title.trim(),
              dueAt: c.dueAt ? new Date(c.dueAt).toISOString() : undefined,
              successMetric: c.metric || undefined,
            })),
          })}
          className="w-full inline-flex items-center justify-center gap-2 border border-gold-500 bg-gold-500 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950 disabled:opacity-40">
          <CheckCircle2 size={14} /> {alreadyDecided ? "Recorded" : saving ? "Recording…" : "Record decision"}
        </button>
      </div>
    </div>
  );
}

function useLiveDuration(startedAt: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return useMemo(() => Math.round((now - startedAt) / 1000), [now, startedAt]);
}
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60); const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
