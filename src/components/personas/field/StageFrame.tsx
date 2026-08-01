// Chamber 07 · Field stage frame.
//
// Every field stage wears the same three-part frame: a masthead that says what
// this stage decides, the work surface itself, and a sticky decision bar that
// always carries exactly one next action. A user should never have to guess
// what the product wants from them here.

import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CircleDashed } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import {
  FIELD_STAGE_SPECS,
  FIELD_STAGES,
  nextFieldStage,
  prevFieldStage,
  type FieldProgress,
  type FieldStageKey,
} from "@/lib/personas/field-stages";
import { cn } from "@/lib/utils";

const STEP_ROUTE = "/admin/countries/$code/personas/field/$step" as const;
const DOOR_ROUTE = "/admin/countries/$code/personas" as const;

function StageLink({
  code,
  projectId,
  stage,
  className,
  children,
}: {
  code: string;
  projectId: string;
  stage: FieldStageKey;
  className?: string;
  children: React.ReactNode;
}) {
  if (stage === "brief") {
    return (
      <Link to={DOOR_ROUTE} params={{ code }} search={{ project: projectId }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link
      to={STEP_ROUTE}
      params={{ code, step: stage }}
      search={{ project: projectId }}
      className={className}
    >
      {children}
    </Link>
  );
}

export function StageFrame({
  code,
  projectId,
  stage,
  progress,
  children,
}: {
  code: string;
  projectId: string;
  stage: FieldStageKey;
  progress: FieldProgress | undefined;
  children: React.ReactNode;
}) {
  const spec = FIELD_STAGE_SPECS[stage];
  const state = progress?.stages[stage];
  const complete = !!state?.complete;
  const next = nextFieldStage(stage);
  const prev = prevFieldStage(stage);
  const position = FIELD_STAGES.indexOf(stage) + 1;

  return (
    <section className="space-y-5 pb-24">
      <header className="border-b border-line-200 pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Stage {String(spec.n).padStart(2, "0")} · {spec.sub}
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">{spec.label}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-700">{spec.decides}</p>

        <div
          className={cn(
            "mt-3 flex max-w-2xl items-start gap-2 border p-3",
            complete ? "border-emerald-500/40 bg-emerald-500/5" : "border-line-200 bg-paper-100/40",
          )}
        >
          {complete ? (
            <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
          ) : (
            <CircleDashed size={14} className="mt-0.5 shrink-0 text-ink-500" />
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              <Explain id="research.stage.done" mark={false}>
                Done when
              </Explain>
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-800">{spec.doneWhen}</p>
            {!complete && state?.blocker ? (
              <p className="mt-1 text-[12px] text-ink-600">Outstanding · {state.blocker}</p>
            ) : null}
          </div>
        </div>
      </header>

      {children}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-200 bg-paper-0/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-0/85">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {prev ? (
              <StageLink code={code} projectId={projectId} stage={prev} className="btn-ghost">
                <ArrowLeft size={12} /> {FIELD_STAGE_SPECS[prev].label}
              </StageLink>
            ) : (
              <span />
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {position} of {FIELD_STAGES.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!complete && state?.blocker ? (
              <span className="hidden max-w-sm truncate text-[12px] text-ink-600 sm:block">
                {state.blocker}
              </span>
            ) : null}
            {next ? (
              <StageLink
                code={code}
                projectId={projectId}
                stage={next}
                className={complete ? "btn-primary" : "btn-secondary"}
              >
                {complete ? spec.advance : `Skip ahead to ${FIELD_STAGE_SPECS[next].label}`}{" "}
                <ArrowRight size={12} />
              </StageLink>
            ) : (
              <Link
                to={DOOR_ROUTE}
                params={{ code }}
                search={{ project: projectId }}
                className="btn-primary"
              >
                {spec.advance} <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** An empty state that names the one action which fills it. */
export function EmptyAction({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-line-200 bg-paper-100/30 p-6">
      <p className="font-serif text-lg text-ink-950">{title}</p>
      <p className="mt-1 max-w-xl text-sm text-ink-700">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
