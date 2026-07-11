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

  const m = useMutation({
    mutationFn: () => save({ data: { id, scopeKey: data.scope_key, strategyId: data.strategy_id ?? undefined, kind, audience, channel, body, draftState: state } }),
    onSuccess: () => navigate({ to: "/narrative/comms" }),
  });

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
            <span className="block text-xs uppercase tracking-widest text-ink-500">State</span>
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
            {m.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </main>
  );
}
