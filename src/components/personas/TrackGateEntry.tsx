// Chamber 07 · Chamber entrance gate.
//
// Nothing in this chamber starts until the principal says how the question
// should be asked. This is the no-programme-selected view: name the
// programme, then choose the instrument. The programme is created already
// on that track, so the rail is correct from the first screen.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Loader2, Users2, Wand2 } from "lucide-react";

import { createProject } from "@/lib/personas/projects.functions";
import { RESEARCH_TRACKS, TRACK_META, type ResearchTrack } from "@/lib/personas/tracks";

export function TrackGateEntry({ code }: { code: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProject);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const create = useMutation({
    mutationFn: (track: ResearchTrack) =>
      createFn({ data: { countryCode: code, title: title.trim(), visibility, track } }),
    onSuccess: async (row: { id: string }, track) => {
      await qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      window.location.assign(
        track === "field"
          ? `/admin/countries/${code}/personas?project=${row.id}&open=1`
          : `/admin/countries/${code}/personas?project=${row.id}`,
      );
    },
  });

  const ready = title.trim().length >= 2;

  return (
    <section className="border border-ink-950 bg-paper-0">
      <header className="border-b border-line-200 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Stage 00 · Choose the track
        </p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
          One chamber, two instruments.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700">
          A synthetic public answers today and shows you where the argument is weak. A field
          programme answers in weeks and gives you evidence a Cabinet can publish. Name the
          programme, then choose the instrument the decision deserves — you can add the other later.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this research programme — e.g. Tourism levy acceptance"
            className="min-w-[280px] flex-1 border border-line-200 bg-paper-0 px-3 py-2 text-sm focus:border-ink-950 focus:outline-none"
          />
          <label className="flex items-center gap-1 text-[11px] text-ink-700">
            <input
              type="radio"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />{" "}
            Public
          </label>
          <label className="flex items-center gap-1 text-[11px] text-ink-700">
            <input
              type="radio"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />{" "}
            Private
          </label>
        </div>
      </header>

      <div className="grid gap-px bg-line-200 md:grid-cols-3">
        {RESEARCH_TRACKS.map((key) => {
          const meta = TRACK_META[key];
          const Icon = key === "synthetic" ? Wand2 : key === "field" ? Users2 : Clock;
          const pending = create.isPending && create.variables === key;
          return (
            <article key={key} className="flex flex-col bg-paper-0 p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center border border-ink-950 bg-ink-950 text-paper-0">
                  <Icon size={13} />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  {meta.label}
                </p>
              </div>
              <h3 className="mt-3 font-serif text-xl leading-tight text-ink-950">{meta.promise}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-700">{meta.body}</p>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-200 pt-3">
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                    Time to answer
                  </dt>
                  <dd className="mt-0.5 font-serif text-sm text-ink-950">{meta.tempo}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                    Standard of proof
                  </dt>
                  <dd className="mt-0.5 font-serif text-sm text-ink-950">{meta.proof}</dd>
                </div>
              </dl>

              <ul className="mt-3 space-y-1">
                {meta.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-1.5 text-[12px] text-ink-700">
                    <Check size={12} className="mt-0.5 shrink-0 text-ink-500" /> {b}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => create.mutate(key)}
                disabled={!ready || create.isPending}
                title={ready ? undefined : "Name the programme first"}
                className="btn-primary mt-4 w-full justify-center disabled:opacity-40"
              >
                {pending ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Opening…
                  </>
                ) : (
                  `Start ${meta.label}`
                )}
              </button>
            </article>
          );
        })}
      </div>

      {create.isError && (
        <p className="border-t border-line-200 px-5 py-3 text-[11px] text-rose-600">
          {(create.error as Error).message}
        </p>
      )}
    </section>
  );
}
