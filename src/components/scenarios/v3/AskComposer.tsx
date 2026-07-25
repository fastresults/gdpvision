import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { askAndCreateScenario } from "@/lib/scenarios/ask.functions";
import { CARIBBEAN_CHIPS } from "@/lib/scenarios/caribbean-playbooks";

export function AskComposer({ code }: { code: string }) {
  const [text, setText] = useState("");
  const navigate = useNavigate();

  const ask = useMutation({
    mutationFn: (question: string) =>
      askAndCreateScenario({ data: { countryCode: code, question } }),
    onSuccess: async (res) => {
      if (!res.id) {
        toast.error(res.note ?? "Could not shape that into a scenario. Try rephrasing.");
        return;
      }
      toast.success("Scenario ready");
      await navigate({
        to: "/admin/countries/$code/scenarios/$id",
        params: { code, id: res.id },
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function submit(question: string) {
    const q = question.trim();
    if (q.length < 3) {
      toast.error("Give me a little more to work with.");
      return;
    }
    ask.mutate(q);
  }

  const busy = ask.isPending;

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <header className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
          Chamber 03 · What if…
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-ink-950 md:text-4xl">
          What decision are you weighing?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-500">
          Ask in plain language. We model the ripple across GDP, jobs, ministries and the fiscal balance — grounded in your country's data.
        </p>
      </header>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(text);
          }}
          rows={3}
          disabled={busy}
          placeholder='e.g. "What if we raise the cruise head-tax by $10?"'
          className="w-full resize-none border border-line-200 bg-paper-0 px-5 py-4 font-serif text-lg text-ink-950 placeholder:text-ink-300 focus:border-ink-950 focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => submit(text)}
          disabled={busy || text.trim().length < 3}
          className="btn-primary absolute bottom-3 right-3 inline-flex items-center gap-2 disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Modeling…
            </>
          ) : (
            <>
              Model this <Send className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Or start from a common Caribbean question
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CARIBBEAN_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setText(chip.question);
                submit(chip.question);
              }}
              className="group flex items-center gap-3 border border-line-200 bg-paper-0 px-4 py-3 text-left transition hover:border-ink-950 disabled:opacity-40"
            >
              <span aria-hidden className="text-xl">
                {chip.icon}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-ink-950">{chip.label}</span>
                <span className="mt-0.5 block text-[11px] text-ink-500 line-clamp-1">
                  {chip.question}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-ink-500">
        Advisors and analysts can open the{" "}
        <button
          type="button"
          onClick={() =>
            navigate({ to: "/admin/countries/$code/scenarios/new", params: { code } })
          }
          className="underline decoration-dotted underline-offset-4 hover:text-ink-950"
        >
          full workbench
        </button>{" "}
        with every lever exposed.
      </p>
    </div>
  );
}
