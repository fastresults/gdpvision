import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { askCounsel, listCounselArchive, type CounselAnswer } from "@/lib/counsel.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";
import { Wordmark } from "@/components/marketing/Wordmark";
import { supabase } from "@/integrations/supabase/client";
import { scrollToTop } from "@/lib/utils";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});
function archiveQuery(scope: string) {
  return queryOptions({
    queryKey: ["counsel-archive", scope],
    queryFn: () => listCounselArchive({ data: { scopeKey: scope } }),
  });
}

export const Route = createFileRoute("/_authenticated/counsel/")({
  head: () => ({ meta: [{ title: "Counsel — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: CounselConsole,
});

function CounselConsole() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: archive } = useSuspenseQuery(archiveQuery(code));

  const ask = useServerFn(askCounsel);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CounselAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (q: string) => ask({ data: { scopeKey: code, question: q } }),
    onSuccess: (r) => { setAnswer(r); setErr(null); },
    onError: (e: Error) => setErr(e.message),
  });

  async function signOut() { await supabase.auth.signOut(); }

  return (
    <div className="min-h-dvh bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-8">
          <Link to="/instrument"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Counsel · {code}</span>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500">
          <Link to="/narrative" className="hover:text-ink-950">Narrative</Link>
          <button onClick={signOut} className="hover:text-ink-950">Sign out</button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-8 py-16 lg:grid-cols-[2fr_1fr]">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Ask</p>
          <form
            className="mt-3"
            onSubmit={(e) => { e.preventDefault(); if (question.trim()) mut.mutate(question); }}
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="e.g. What should I tell the House about the CBI wind-down glidepath?"
              className="w-full resize-y border-b border-line-200 bg-transparent py-3 font-serif text-2xl leading-snug text-ink-950 placeholder:text-ink-300 focus:border-ink-950 focus:outline-none"
            />
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Retrieves from Second Brain + latest Ledger scenario. Citations are enforced.
              </span>
              <button
                type="submit"
                disabled={mut.isPending}
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-950 hover:underline underline-offset-4 disabled:opacity-50"
              >
                {mut.isPending ? "Consulting…" : "Ask Counsel →"}
              </button>
            </div>
          </form>

          {err && (
            <p className="mt-8 rounded-sm border border-red-300 bg-red-50 p-4 font-mono text-[12px] text-red-800">
              {err}
            </p>
          )}

          {answer && (
            <article className="mt-12 space-y-10">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Spoken</p>
                <p className="mt-3 font-serif text-3xl leading-snug text-ink-950">{answer.spoken_block}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Written</p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-800">{answer.written_block || "—"}</pre>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Citations</p>
                <ol className="mt-3 space-y-1 text-sm">
                  {answer.citations.map((c, i) => (
                    <li key={c.id} className="flex gap-3">
                      <span className="font-mono text-ink-500 w-6">[{i + 1}]</span>
                      <span>{c.title}</span>
                      <span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-ink-500">{c.kind} · {c.sector_code} · w{c.weight}</span>
                    </li>
                  ))}
                  {answer.citations.length === 0 && <li className="text-ink-500">No matching Second Brain items — treat answer as unsupported.</li>}
                </ol>
              </div>
              {answer.scenario_snapshot && (
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  Scenario snapshot · model {answer.scenario_snapshot.model_version} · horizon {answer.scenario_snapshot.horizon_years}y
                </p>
              )}
            </article>
          )}
        </section>

        <aside>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Archive</p>
          <ul className="mt-3 divide-y divide-line-200 border-y border-line-200">
            {archive.map((a) => (
              <li key={a.id} className="py-3 text-sm">
                <p className="text-ink-950">{a.question}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {new Date(a.created_at).toISOString().slice(0, 16).replace("T", " ")}
                </p>
              </li>
            ))}
            {archive.length === 0 && <li className="py-8 text-center text-ink-500 text-sm">No prior consultations.</li>}
          </ul>
        </aside>
      </main>
    </div>
  );
}
