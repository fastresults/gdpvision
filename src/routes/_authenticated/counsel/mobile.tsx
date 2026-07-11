import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { askCounsel, type CounselAnswer } from "@/lib/counsel.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});

export const Route = createFileRoute("/_authenticated/counsel/mobile")({
  head: () => ({
    meta: [
      { title: "Counsel — GDPVision" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: CounselMobile,
});

function CounselMobile() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";

  const ask = useServerFn(askCounsel);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CounselAnswer | null>(null);
  const [holding, setHolding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const mut = useMutation({
    mutationFn: (q: string) => ask({ data: { scopeKey: code, question: q } }),
    onSuccess: (r) => { setAnswer(r); setErr(null); setSheetOpen(true); },
    onError: (e: Error) => setErr(e.message),
  });

  // Placeholder press-and-hold. Real voice capture lands with the SEDE audio port;
  // the shell here proves the interaction rhythm on device.
  function submit() {
    const q = question.trim();
    if (!q) return;
    mut.mutate(q);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between px-6 py-4 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500">
        <span>Counsel · {code}</span>
        <Link to="/instrument" className="hover:text-ink-950">Instrument →</Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-40">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          Hold to talk. Release to send.
        </p>

        <button
          type="button"
          aria-label="Hold to talk"
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => { setHolding(false); submit(); }}
          onPointerCancel={() => setHolding(false)}
          onPointerLeave={() => holding && setHolding(false)}
          className={`mt-8 flex h-56 w-56 select-none items-center justify-center rounded-full border-2 border-ink-950 transition ${
            holding ? "scale-95 bg-ink-950 text-paper-0" : "bg-paper-0 text-ink-950"
          }`}
        >
          <span className="font-serif text-2xl">{holding ? "Listening" : mut.isPending ? "Consulting…" : "Ask"}</span>
        </button>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type or dictate the question…"
          rows={3}
          className="mt-10 w-full max-w-md resize-y border-b border-line-200 bg-transparent py-3 text-center font-serif text-xl leading-snug text-ink-950 placeholder:text-ink-300 focus:border-ink-950 focus:outline-none"
        />

        {err && <p className="mt-6 max-w-md text-center text-sm text-red-700">{err}</p>}
      </main>

      {/* Slide-up answer sheet */}
      <div
        aria-hidden={!sheetOpen}
        className={`fixed inset-x-0 bottom-0 z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-line-200 bg-paper-0 p-6 shadow-2xl transition-transform duration-300 ${
          sheetOpen && answer ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        {answer && (
          <>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Counsel says</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950"
              >
                Close
              </button>
            </div>
            <p className="mt-4 font-serif text-2xl leading-snug">{answer.spoken_block}</p>

            {answer.citations.length > 0 && (
              <>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Citations</p>
                <ol className="mt-2 space-y-2 text-sm">
                  {answer.citations.map((c, i) => (
                    <li key={c.id} className="flex items-baseline gap-3">
                      <span className="w-5 font-mono text-ink-500">[{i + 1}]</span>
                      <span className="min-w-0 flex-1">{c.title}</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">w{c.weight}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {answer.citations.length === 0 && (
              <p className="mt-4 text-sm text-red-700">No matching Second-Brain citations — treat answer as unsupported.</p>
            )}

            <div className="mt-8 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                {answer.scenario_snapshot ? `snapshot · h${answer.scenario_snapshot.horizon_years}y` : "no snapshot"}
              </span>
              <Link
                to="/counsel/archive"
                className="font-mono text-[10px] uppercase tracking-widest text-ink-950 hover:underline underline-offset-4"
              >
                Archive →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
