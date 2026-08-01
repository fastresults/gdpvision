// Chamber 07 · Stage 00, second beat — confirm what the chamber read.
//
// The AI has already read the material and proposed a programme. This screen
// is a confirmation, not a form: the proposed name is editable, the read-out
// is visible, the recommended instrument is pre-selected and overridable.
// When no material was supplied it degrades to a plain naming screen.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Lock, Sparkles, Unlock } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import { createProject } from "@/lib/personas/projects.functions";
import type { ProgrammeProposal } from "@/lib/personas/project-brief.functions";
import { TRACK_META, type ResearchTrack } from "@/lib/personas/tracks";
import type { IngestMaterial } from "./ProgrammeIngest";
import "@/lib/explain/personas-entries";
import { cn } from "@/lib/utils";

export function ProgrammeSetup({
  code,
  track,
  proposal,
  material,
  onBack,
  backLabel = "Change instrument",
}: {
  code: string;
  track: ResearchTrack;
  proposal?: ProgrammeProposal;
  material?: IngestMaterial;
  onBack: () => void;
  backLabel?: string;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProject);
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [chosenTrack, setChosenTrack] = useState<ResearchTrack>(track);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = TRACK_META[chosenTrack];
  const scope = proposal?.scope;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          countryCode: code,
          title: title.trim(),
          visibility,
          track: chosenTrack,
          ...(material ? { brief_raw: material.raw, brief_uploads: material.uploads } : {}),
          ...(proposal ? { brief_scope: proposal.scope } : {}),
        },
      }),
    onSuccess: async (row: { id: string }) => {
      await qc.invalidateQueries({ queryKey: ["persona-projects", code] });
      window.location.assign(
        chosenTrack === "field"
          ? `/admin/countries/${code}/personas?project=${row.id}&open=1`
          : `/admin/countries/${code}/personas?project=${row.id}`,
      );
    },
  });

  const ready = title.trim().length >= 2;

  return (
    <section className="min-w-0 overflow-x-clip border border-ink-950 bg-paper-0">
      <header className="border-b border-line-200 px-6 py-5 sm:px-10 sm:py-7">
        <button type="button" onClick={onBack} className="btn-ghost -ml-2">
          <ArrowLeft size={12} /> {backLabel}
        </button>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Stage 00 · {proposal ? "What the chamber read" : `${meta.label} — ${meta.tempo.toLowerCase()} to an answer`}
        </p>
        <h2 className="mt-2 font-serif text-3xl leading-tight text-ink-950">
          {proposal ? "This is the programme your material implies." : "Name this programme."}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-700">
          {proposal
            ? "Edit anything that is wrong. Everything below travels into the brief, so nothing is typed twice."
            : "One line a Cabinet would recognise — the decision this research is meant to inform."}
        </p>
      </header>

      <form
        className="px-6 py-6 sm:px-10 sm:py-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !create.isPending) create.mutate();
        }}
      >
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Tourism levy acceptance among coastal households"
          className="w-full border-0 border-b border-line-200 bg-transparent pb-3 font-serif text-xl text-ink-950 placeholder:text-ink-300 focus:border-ink-950 focus:outline-none sm:text-2xl"
        />

        {scope && (
          <div className="mt-7 grid gap-6 border border-line-200 p-5 sm:grid-cols-2">
            <ReadOut label="Decisions it must inform" items={scope.decisions} />
            <ReadOut label="Objectives" items={scope.objectives} />
            <ReadOut label="Hypotheses to test" items={scope.hypotheses} />
            <ReadOut
              label="Scope"
              items={[scope.geography, scope.timeframe].filter(Boolean) as string[]}
            />
            {scope.sensitivities?.length > 0 && (
              <ReadOut label="Handle carefully" items={scope.sensitivities} />
            )}
            {proposal?.openQuestions?.length ? (
              <ReadOut label="The material doesn't answer" items={proposal.openQuestions} />
            ) : null}
          </div>
        )}

        {/* Instrument */}
        <div className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Instrument{" "}
            {proposal && (
              <span className="text-ink-300">
                · <Explain id="research.intake.recommendation">recommended by the read</Explain>
              </span>
            )}
          </p>
          {proposal?.trackReason && (
            <p className="mt-2 flex max-w-2xl items-start gap-2 text-[12px] leading-relaxed text-ink-700">
              <Sparkles size={12} className="mt-0.5 shrink-0" />
              {proposal.trackReason}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(["synthetic", "field", "blended"] as ResearchTrack[]).map((t) => {
              const m = TRACK_META[t];
              const on = chosenTrack === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChosenTrack(t)}
                  className={cn("card-choice max-w-xs flex-1 px-4 py-3 text-left", on && "card-choice-active")}
                >
                  <span className="font-serif text-sm">{m.label}</span>
                  <span className="mt-1 block text-[11px] leading-snug opacity-70">
                    {m.tempo} · {m.proof}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Who may see the returns
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                {
                  key: "public" as const,
                  icon: Unlock,
                  label: "Public to the country",
                  hint: "Every user under this country admin",
                },
                {
                  key: "private" as const,
                  icon: Lock,
                  label: "Private",
                  hint: "Visible only to country admins",
                },
              ]
            ).map((o) => {
              const Icon = o.icon;
              const on = visibility === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setVisibility(o.key)}
                  className={cn("card-choice max-w-xs flex-1 px-4 py-3 text-left", on && "card-choice-active")}
                >
                  <span className="flex items-center gap-2 font-serif text-sm">
                    <Icon size={13} /> {o.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug opacity-70">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={!ready || create.isPending} className="btn-primary disabled:opacity-40">
            {create.isPending ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Opening the chamber…
              </>
            ) : (
              `Open ${meta.label}`
            )}
          </button>
          {!ready && (
            <p className="text-[11px] text-ink-500">Give the programme a name to continue.</p>
          )}
        </div>

        {create.isError && (
          <p className="mt-4 text-[11px] text-rose-600">{(create.error as Error).message}</p>
        )}
      </form>
    </section>
  );
}

function ReadOut({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 6).map((i) => (
          <li key={i} className="text-[12.5px] leading-relaxed text-ink-700">
            <span className="mr-2 text-ink-300">—</span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
