// Chamber 07 · Chamber entrance gate.
//
// AI-first: the chamber opens on intake, not on a form. The principal gives
// it material, the AI reads that into a proposed programme and recommends an
// instrument. Only when nothing is to hand does the fork below appear as a
// manual choice — two instruments, one decision. Blended stays a quiet line.

import { useState } from "react";
import { ArrowRight, Users2, Wand2 } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import { Illustration } from "@/components/marketing/Illustration";
import { TRACK_META, type ResearchTrack } from "@/lib/personas/tracks";
import type { ProgrammeProposal } from "@/lib/personas/project-brief.functions";
import "@/lib/explain/personas-entries";
import syntheticArt from "@/assets/illustrations/research-synthetic.jpg";
import fieldArt from "@/assets/illustrations/research-field.jpg";

import { ProgrammeIngest, type IngestMaterial } from "./ProgrammeIngest";
import { ProgrammeSetup } from "./ProgrammeSetup";

const PANELS = [
  {
    key: "synthetic" as const,
    icon: Wand2,
    art: syntheticArt,
    explainId: "research.proof.synthetic",
    question: "Ask a synthetic public — today.",
    line: "AI casts a public from this country's second brain, groups it into audiences a Cabinet can act on, and rehearses the conversation before you have it.",
    bullets: ["Cast personas", "Group segments", "Rehearse studies"],
  },
  {
    key: "field" as const,
    icon: Users2,
    art: fieldArt,
    explainId: "research.proof.field",
    question: "Ask the real public — properly.",
    line: "The brief becomes a dated programme: phases, milestones, participants, instruments and sessions — every return filed to the second brain.",
    bullets: ["Programme plan & milestones", "Participants & comms", "Instruments & fieldwork"],
  },
];

type Stage =
  | { step: "intake" }
  | { step: "fork" }
  | { step: "setup"; track: ResearchTrack; proposal?: ProgrammeProposal; material?: IngestMaterial };

export function TrackGateEntry({ code }: { code: string }) {
  const [stage, setStage] = useState<Stage>({ step: "intake" });

  if (stage.step === "intake") {
    return (
      <ProgrammeIngest
        code={code}
        onProposal={(proposal, material) =>
          setStage({ step: "setup", track: proposal.recommendedTrack, proposal, material })
        }
        onSkip={() => setStage({ step: "fork" })}
      />
    );
  }

  if (stage.step === "setup") {
    return (
      <ProgrammeSetup
        code={code}
        track={stage.track}
        proposal={stage.proposal}
        material={stage.material}
        backLabel={stage.proposal ? "Back to the material" : "Change instrument"}
        onBack={() => setStage(stage.proposal ? { step: "intake" } : { step: "fork" })}
      />
    );
  }


  return (
    <section className="border border-ink-950 bg-paper-0">
      <header className="border-b border-ink-950 px-6 py-7 text-center sm:px-10 sm:py-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Stage 00 · The gate
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl font-serif text-[2rem] leading-[1.1] text-ink-950 sm:text-4xl">
          How should this question be asked?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-700">
          Pick one instrument. Nothing in this chamber opens until you do — and you can add the
          other one to the same programme later.
        </p>
      </header>

      <div className="grid gap-px bg-line-200 lg:grid-cols-2">
        {PANELS.map((p) => {
          const meta = TRACK_META[p.key];
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setStage({ step: "setup", track: p.key })}
              className="group flex min-h-[420px] flex-col bg-paper-0 p-6 text-left transition-colors hover:bg-paper-50 focus:outline-none focus-visible:bg-paper-50 sm:p-9"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
                    <Icon size={13} /> {meta.label}
                  </p>
                  <h3 className="mt-3 max-w-sm font-serif text-2xl leading-tight text-ink-950 sm:text-[1.75rem]">
                    {p.question}
                  </h3>
                </div>
                <Illustration
                  src={p.art}
                  variant="mark"
                  className="hidden shrink-0 opacity-80 sm:block"
                />
              </div>

              <div className="mt-7 grid grid-cols-2 gap-6 border-y border-line-200 py-5">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                    Time to answer
                  </p>
                  <p className="mt-1 font-serif text-3xl leading-none text-ink-950">{meta.tempo}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                    Standard of proof
                  </p>
                  <p className="mt-1 font-serif text-xl leading-tight text-ink-950">
                    <Explain id={p.explainId}>{meta.proof}</Explain>
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-md text-[13px] leading-relaxed text-ink-700">{p.line}</p>

              <ul className="mt-4 space-y-1.5">
                {p.bullets.map((b) => (
                  <li key={b} className="text-[12px] text-ink-700">
                    <span className="mr-2 text-ink-300">—</span>
                    {b}
                  </li>
                ))}
              </ul>

              <span className="btn-primary mt-auto w-full justify-center pt-0 opacity-90 transition-opacity group-hover:opacity-100">
                Choose {meta.label} <ArrowRight size={12} />
              </span>
            </button>
          );
        })}
      </div>

      <footer className="border-t border-line-200 px-6 py-4 text-center sm:px-10">
        <p className="text-[12px] text-ink-700">
          Not sure?{" "}
          <button type="button" onClick={() => setChosen("blended")} className="underline underline-offset-2 hover:text-ink-950">
            Run both — rehearse today, verify in the field.
          </button>
        </p>
      </footer>
    </section>
  );
}
