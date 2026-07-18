import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { createSession, listCommitments, listSessions, updateCommitmentStatus } from "@/lib/mandate.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

function sessionsQuery(code: string) {
  return queryOptions({
    queryKey: ["cabinet-sessions", code],
    queryFn: () => listSessions({ data: { countryCode: code } }),
  });
}
function commitmentsQuery(code: string) {
  return queryOptions({
    queryKey: ["commitments", code],
    queryFn: () => listCommitments({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/instrument/cabinet/")({
  head: () => ({ meta: [{ title: "Cabinet Room — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: CabinetRoom,
});

function CabinetRoom() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = useChamberCountry(bindings);
  const { data: sessions } = useSuspenseQuery(sessionsQuery(code));
  const { data: commits } = useSuspenseQuery(commitmentsQuery(code));

  const qc = useQueryClient();
  const create = useServerFn(createSession);
  const updateStatus = useServerFn(updateCommitmentStatus);
  const [title, setTitle] = useState("");

  const createMut = useMutation({
    mutationFn: () => create({ data: { countryCode: code, title, agenda: [], scheduledFor: new Date().toISOString() } }),
    onSuccess: () => { setTitle(""); qc.invalidateQueries({ queryKey: ["cabinet-sessions", code] }); },
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "open"|"in_progress"|"delivered"|"blocked"|"cancelled" }) =>
      updateStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commitments", code] }),
  });

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="flex items-baseline justify-between">
        <SectionHeader eyebrow={`${code} · Cabinet`} title="The Room" />
        <Link to="/instrument/cabinet/session" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4">
          Enter Session Mode →
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <section>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Sessions</h3>
          <form
            className="mt-4 flex gap-3"
            onSubmit={(e) => { e.preventDefault(); if (title.trim()) createMut.mutate(); }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New session title"
              className="flex-1 border-b border-line-200 bg-transparent py-1 text-sm focus:border-ink-950 focus:outline-none"
            />
            <button className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4" disabled={createMut.isPending}>
              Schedule →
            </button>
          </form>
          <ul className="mt-6 divide-y divide-line-200 border-t border-line-200">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between py-3 text-sm">
                <span>{s.title}</span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
                  {s.held_at ? "held" : s.scheduled_for ? new Date(s.scheduled_for).toISOString().slice(0, 10) : "draft"} · {s.classification}
                </span>
              </li>
            ))}
            {sessions.length === 0 && <li className="py-8 text-center text-ink-500 text-sm">No sessions yet.</li>}
          </ul>
        </section>

        <section>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Commitments register</h3>
          <ul className="mt-4 divide-y divide-line-200 border-t border-line-200">
            {commits.map((c) => (
              <li key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 text-sm">
                <span>{c.title}</span>
                <span className="font-mono text-[11px] text-ink-500">{c.due_at ? new Date(c.due_at).toISOString().slice(0,10) : "—"}</span>
                <select
                  value={c.status}
                  onChange={(e) => statusMut.mutate({ id: c.id, status: e.target.value as "open"|"in_progress"|"delivered"|"blocked"|"cancelled" })}
                  className="border-b border-line-200 bg-transparent font-mono text-[10px] uppercase tracking-widest text-ink-950 focus:outline-none"
                >
                  {["open","in_progress","delivered","blocked","cancelled"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </li>
            ))}
            {commits.length === 0 && <li className="py-8 text-center text-ink-500 text-sm">No commitments recorded yet.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
