// Chamber 07 · Track picker.
//
// The first decision in any research programme: rehearse with a synthetic
// public today, or field the real one properly. Shown once, then remembered
// on the programme (switchable later from the track rail).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Loader2, Users2, Wand2 } from "lucide-react";

import { setProjectTrack } from "@/lib/personas/projects.functions";
import { RESEARCH_TRACKS, TRACK_META, type ResearchTrack } from "@/lib/personas/tracks";
import { cn } from "@/lib/utils";

export function TrackPicker({
  code,
  projectId,
  projectTitle,
  current,
  onChosen,
}: {
  code: string;
  projectId: string;
  projectTitle?: string;
  current?: ResearchTrack;
  onChosen?: (track: ResearchTrack) => void;
}) {
  const qc = useQueryClient();
  const setTrackFn = useServerFn(setProjectTrack);
  const choose = useMutation({
    mutationFn: (track: ResearchTrack) => setTrackFn({ data: { projectId, track } }),
    onSuccess: async (_r, track) => {
      await qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      onChosen?.(track);
    },
  });

  return (
    <section className="border border-ink-950 bg-paper-0">
      <header className="border-b border-line-200 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Stage 00 · Choose the track
        </p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-ink-950">
          How should {projectTitle ? `“${projectTitle}”` : "this programme"} ask the question?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700">
          One chamber, two instruments. A synthetic public answers today and tells you where the
          argument is weak. A field programme answers in weeks and gives you evidence a Cabinet can
          publish. Choose the one the decision deserves — you can add the other later.
        </p>
      </header>

      <div className="grid gap-px bg-line-200 md:grid-cols-3">
        {RESEARCH_TRACKS.map((key) => {
          const meta = TRACK_META[key];
          const Icon = key === "synthetic" ? Wand2 : key === "field" ? Users2 : Clock;
          const active = current === key;
          const pending = choose.isPending && choose.variables === key;
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
                onClick={() => choose.mutate(key)}
                disabled={choose.isPending}
                className={cn("btn-primary mt-4 w-full justify-center", active && "opacity-70")}
              >
                {pending ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Setting…
                  </>
                ) : active ? (
                  "Current track"
                ) : (
                  `Run ${meta.label}`
                )}
              </button>
            </article>
          );
        })}
      </div>

      {choose.isError && (
        <p className="border-t border-line-200 px-5 py-3 text-[11px] text-rose-600">
          {(choose.error as Error).message}
        </p>
      )}
    </section>
  );
}
