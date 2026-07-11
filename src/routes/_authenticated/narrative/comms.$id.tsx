import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { approveComms, getComms, saveComms } from "@/lib/narrative.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const KINDS = ["press_release", "op_ed", "briefing", "speech", "social", "memo"] as const;
const STATES = ["draft", "review", "approved", "released"] as const;

function commsQ(id: string) {
  return queryOptions({ queryKey: ["comms", id], queryFn: () => getComms({ data: { id } }) });
}

export const Route = createFileRoute("/_authenticated/narrative/comms/$id")({
  head: () => ({ meta: [{ title: "Edit comms — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(commsQ(params.id)),
  component: EditComms,
});

function EditComms() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const save = useServerFn(saveComms);
  const { data } = useSuspenseQuery(commsQ(id));

  const [kind, setKind] = useState<(typeof KINDS)[number]>(data.kind as (typeof KINDS)[number]);
  const [audience, setAudience] = useState(data.audience);
  const [channel, setChannel] = useState(data.channel);
  const [body, setBody] = useState(data.body ?? "");
  const [state, setState] = useState<(typeof STATES)[number]>(data.draft_state as (typeof STATES)[number]);
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () => save({ data: { id, scopeKey: data.scope_key, strategyId: data.strategy_id ?? undefined, kind, audience, channel, body, draftState: state } }),
    onSuccess: () => navigate({ to: "/narrative/comms" }),
  });

  const approve = useServerFn(approveComms);
  const advance = useMutation({
    mutationFn: (next: "review" | "approved" | "released") =>
      approve({ data: { id, nextState: next, note: note || undefined } }),
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["comms", id] }); },
  });

  const approvals = Array.isArray(data.approvals) ? (data.approvals as Array<{ at: string; from: string; to: string; note?: string | null; figures?: string[] }>) : [];
  const nextByCurrent: Record<string, ("review" | "approved" | "released")[]> = {
    draft: ["review"], review: ["approved"], approved: ["released"], released: [],
  };
  const nexts = nextByCurrent[data.draft_state] ?? [];

  return (
    <main className="mx-auto max-w-4xl px-8 py-16">
      <SectionHeader eyebrow={`${data.scope_key} · ${data.draft_state}`} title="Edit comms artifact" />
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="mt-12 space-y-6">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">Kind</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">Audience</span>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2" />
          </label>
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">Channel</span>
            <input value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono" />
          </label>
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">State (manual)</span>
            <select value={state} onChange={(e) => setState(e.target.value as typeof state)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono">
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-ink-500">Body</span>
          <textarea rows={16} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono text-sm" />
        </label>
        {m.error && <p className="text-sm text-red-600">{(m.error as Error).message}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate({ to: "/narrative/comms" })} className="border border-line-200 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={m.isPending} className="bg-ink-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {m.isPending ? "Saving…" : "Save draft edits"}
          </button>
        </div>
      </form>

      <section className="mt-16 border-t border-line-200 pt-10">
        <h2 className="text-sm uppercase tracking-widest text-ink-500">Approval doctrine</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          Each transition requires a qualifying role. Release additionally requires a Ledger sign-off note when the body cites fiscal figures.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Sign-off note (required for release with figures)"
            className="flex-1 min-w-[240px] border border-line-200 bg-transparent px-3 py-2 text-sm"
          />
          {nexts.map((n) => (
            <button key={n} type="button" disabled={advance.isPending}
              onClick={() => advance.mutate(n)}
              className="border border-ink-900 px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-ink-900 hover:text-white disabled:opacity-50">
              → {n}
            </button>
          ))}
          {nexts.length === 0 && <span className="text-xs font-mono text-ink-500">terminal state</span>}
        </div>
        {advance.error && <p className="mt-3 text-sm text-red-600">{(advance.error as Error).message}</p>}

        <ol className="mt-8 space-y-3 text-sm">
          {approvals.length === 0 && <li className="text-ink-500">No approval events yet.</li>}
          {approvals.slice().reverse().map((a, i) => (
            <li key={i} className="border-l-2 border-line-200 pl-4">
              <div className="font-mono text-xs text-ink-500">{new Date(a.at).toISOString().replace("T", " ").slice(0, 16)} · {a.from} → {a.to}</div>
              {a.note && <div className="mt-1">{a.note}</div>}
              {a.figures && a.figures.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2 text-xs font-mono text-ink-500">
                  {a.figures.map((f, j) => <span key={j} className="border border-line-200 px-2 py-0.5">{f}</span>)}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

