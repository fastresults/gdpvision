import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { saveComms } from "@/lib/narrative.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

export const Route = createFileRoute("/_authenticated/narrative/comms/new")({
  head: () => ({ meta: [{ title: "New comms artifact — GDPVision" }, { name: "robots", content: "noindex" }] }),
  component: NewComms,
});

const KINDS = ["press_release", "op_ed", "briefing", "speech", "social", "memo"] as const;
const STATES = ["draft", "review", "approved", "released"] as const;

function NewComms() {
  const navigate = useNavigate();
  const save = useServerFn(saveComms);
  const [scope, setScope] = useState("LCA");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("press_release");
  const [audience, setAudience] = useState("");
  const [channel, setChannel] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<(typeof STATES)[number]>("draft");

  const m = useMutation({
    mutationFn: () => save({ data: { scopeKey: scope, kind, audience, channel, body, draftState: state } }),
    onSuccess: () => navigate({ to: "/narrative/comms" }),
  });

  return (
    <main className="mx-auto max-w-4xl px-8 py-16">
      <SectionHeader eyebrow={`${scope} · Comms Studio`} title="New artifact" />
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="mt-12 space-y-6">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 text-sm">
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">Scope</span>
            <input value={scope} onChange={(e) => setScope(e.target.value.toUpperCase())} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono" />
          </label>
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">Kind</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">Audience</span>
            <input required value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2" />
          </label>
          <label>
            <span className="block text-xs uppercase tracking-widest text-ink-500">Channel</span>
            <input required value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-ink-500">Body</span>
          <textarea required rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 w-full border border-line-200 bg-transparent px-3 py-2 font-mono text-sm" />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-ink-500">State</span>
          <select value={state} onChange={(e) => setState(e.target.value as typeof state)} className="mt-1 border border-line-200 bg-transparent px-3 py-2 font-mono">
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
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
