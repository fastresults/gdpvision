// Chamber 07 · Stage 00, second half.
//
// The track is already chosen. This is the only remaining commitment: name
// the programme and say whether it is public to the country or private to
// the admin. One action, no competing choices.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Lock, Unlock } from "lucide-react";

import { createProject } from "@/lib/personas/projects.functions";
import { TRACK_META, type ResearchTrack } from "@/lib/personas/tracks";
import { cn } from "@/lib/utils";

export function TrackConfirm({
  code,
  track,
  onBack,
}: {
  code: string;
  track: ResearchTrack;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProject);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = TRACK_META[track];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { countryCode: code, title: title.trim(), visibility, track } }),
    onSuccess: async (row: { id: string }) => {
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
      <header className="border-b border-line-200 px-6 py-5 sm:px-10 sm:py-7">
        <button type="button" onClick={onBack} className="btn-ghost -ml-2">
          <ArrowLeft size={12} /> Change instrument
        </button>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
          Stage 00 · {meta.label} — {meta.tempo.toLowerCase()} to an answer
        </p>
        <h2 className="mt-2 font-serif text-3xl leading-tight text-ink-950">
          Name this programme.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-700">
          One line a Cabinet would recognise — the decision this research is meant to inform.
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
                  <span className="flex items-center gap-2 font-serif text-sm text-ink-950">
                    <Icon size={13} /> {o.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-ink-700">{o.hint}</span>
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
