// @domain mandate-compact
// @tables compact_transformational_plans
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
// Link import removed — using <a> for signal deep-link.
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  ShieldCheck,
  Send,
  ArrowUpRight,
  Loader2,
  FileText,
  Building2,
  Milestone,
  AlertTriangle,
  Gauge,
  Users2,
  BookOpen,
  Crown,
  Download,
} from "lucide-react";

import {
  listTransformationalPlans,
  getTransformationalPlan,
  generateTransformationalPlan,
  approveTransformationalPlan,
  publishTransformationalPlan,
  handoffPlanToNarrative,
  type TransformationalPlan,
  type PlanSection,
  type PlanSectionKind,
} from "@/lib/mandate-compact/transformational-plan.functions";
import { PrintablePlan, DEFAULT_PRINT_CONFIG, type PrintConfig } from "@/components/mandate-compact/plan/PrintablePlan";
import { ExportPdfDialog, suggestFilename, triggerPdfPrint } from "@/components/mandate-compact/plan/ExportPdfDialog";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  PlanSectionKind,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  executive_overture: { label: "Executive overture", icon: Crown },
  mandate_in_numbers: { label: "Mandate in numbers", icon: Gauge },
  pillar: { label: "Pillar", icon: BookOpen },
  ministry_delivery: { label: "Ministry delivery", icon: Building2 },
  milestone_ladder: { label: "Milestone ladder", icon: Milestone },
  risk_resilience: { label: "Risk & resilience", icon: AlertTriangle },
  measurement_cadence: { label: "Measurement cadence", icon: Gauge },
  stakeholder_compact: { label: "Stakeholder compact", icon: Users2 },
  appendix: { label: "Appendix", icon: FileText },
};

export function PlanPanel({
  compactId,
  countryCode,
}: {
  compactId: string;
  countryCode: string;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listTransformationalPlans);
  const get = useServerFn(getTransformationalPlan);
  const gen = useServerFn(generateTransformationalPlan);
  const approve = useServerFn(approveTransformationalPlan);
  const publish = useServerFn(publishTransformationalPlan);
  const handoff = useServerFn(handoffPlanToNarrative);

  const versionsQ = useQuery({
    queryKey: ["plan-versions", compactId],
    queryFn: () => list({ data: { compactId } }),
  });

  const [pickedVersion, setPickedVersion] = useState<number | null>(null);
  const activeVersion =
    pickedVersion ?? versionsQ.data?.[0]?.version ?? null;

  const planQ = useQuery({
    queryKey: ["plan", compactId, activeVersion],
    queryFn: () =>
      get({ data: { compactId, version: activeVersion ?? undefined } }),
    enabled: !!compactId,
  });

  const plan = planQ.data ?? null;

  const genM = useMutation({
    mutationFn: () => gen({ data: { compactId } }),
    onSuccess: async (p) => {
      toast.success("Transformational Plan drafted", {
        description: `Version ${p.version} · ${p.sections.length} sections`,
      });
      setPickedVersion(p.version);
      await qc.invalidateQueries({ queryKey: ["plan-versions", compactId] });
      await qc.invalidateQueries({ queryKey: ["plan", compactId] });
    },
    onError: (e: Error) => toast.error("Generation failed", { description: e.message }),
  });

  const approveM = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: async () => {
      toast.success("Plan approved for cabinet");
      await qc.invalidateQueries({ queryKey: ["plan", compactId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishM = useMutation({
    mutationFn: (id: string) => publish({ data: { id } }),
    onSuccess: async () => {
      toast.success("Plan published");
      await qc.invalidateQueries({ queryKey: ["plan", compactId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handoffM = useMutation({
    mutationFn: (id: string) => handoff({ data: { id } }),
    onSuccess: async (res) => {
      toast.success("Handed off to Narrative Chamber", {
        description: "Comms can now draft channel copy from the strategy statement.",
      });
      await qc.invalidateQueries({ queryKey: ["plan", compactId] });
      // Deep-link to the signal
      window.open(`/narrative/signal/${res.signalId}?code=${countryCode}`, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const versions = versionsQ.data ?? [];

  return (
    <section className="space-y-8">
      <PlanHeader
        plan={plan}
        countryCode={countryCode}
        onGenerate={() => genM.mutate()}
        generating={genM.isPending}
      />

      {versions.length > 1 && (
        <VersionPicker
          versions={versions}
          activeVersion={activeVersion}
          onPick={setPickedVersion}
        />
      )}

      {!plan && !genM.isPending && (
        <EmptyPlanState onGenerate={() => genM.mutate()} disabled={genM.isPending} />
      )}

      {genM.isPending && <PlanGeneratingSkeleton />}

      {plan && (
        <>
          <PlanCover plan={plan} />
          <MetricsStrip plan={plan} />
          <PlanBody plan={plan} />
          <PlanActions
            plan={plan}
            onApprove={() => approveM.mutate(plan.id)}
            onPublish={() => publishM.mutate(plan.id)}
            onHandoff={() => handoffM.mutate(plan.id)}
            approving={approveM.isPending}
            publishing={publishM.isPending}
            handingOff={handoffM.isPending}
            countryCode={countryCode}
          />
        </>
      )}
    </section>
  );
}

function PlanHeader({
  plan,
  countryCode,
  onGenerate,
  generating,
}: {
  plan: TransformationalPlan | null;
  countryCode: string;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-6 border-b border-line-200 pb-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
          Step 08 · Transformational Plan
        </p>
        <h2 className="mt-2 font-serif text-2xl text-ink-950">
          The cabinet-ready blueprint
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          Synthesizes pillars, pledges, ministry deliverables, and quarterly
          cadence into one signed, citation-backed report — ready for the PM,
          Cabinet, and (via one click) the Narrative Chamber for comms drafting.
        </p>
        {plan && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            {countryCode} · v{plan.version} · {plan.status.replace("_", " ")} ·{" "}
            {new Date(plan.authored_at).toLocaleDateString()}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="btn-primary inline-flex shrink-0 items-center gap-2 disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Drafting…
          </>
        ) : (
          <>
            <Sparkles size={14} /> {plan ? "Generate new version" : "Generate plan"}
          </>
        )}
      </button>
    </header>
  );
}

function VersionPicker({
  versions,
  activeVersion,
  onPick,
}: {
  versions: TransformationalPlan[];
  activeVersion: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border border-line-200 bg-paper-100/40 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Versions
      </span>
      {versions.map((v) => {
        const on = v.version === activeVersion;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onPick(v.version)}
            className={cn(
              "inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition",
              on
                ? "border-ink-950 bg-ink-950 text-paper-0"
                : "border-line-200 text-ink-500 hover:border-ink-950 hover:text-ink-950",
            )}
          >
            v{v.version} · {v.status.replace("_", " ")}
          </button>
        );
      })}
    </div>
  );
}

function EmptyPlanState({
  onGenerate,
  disabled,
}: {
  onGenerate: () => void;
  disabled: boolean;
}) {
  return (
    <div className="border border-dashed border-line-200 bg-paper-100/30 p-10 text-center">
      <Sparkles size={22} className="mx-auto text-gold-500" />
      <h3 className="mt-3 font-serif text-lg text-ink-950">
        No plan drafted yet
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-ink-500">
        Once tracks 01–07 are populated, GDPVision assembles the transformational
        plan in one pass — grounded in every pledge, deliverable, and ministry
        assignment.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        className="btn-primary mt-5 inline-flex items-center gap-2 disabled:opacity-50"
      >
        <Sparkles size={14} /> Generate plan
      </button>
    </div>
  );
}

function PlanGeneratingSkeleton() {
  const stages = [
    "Reading pillars & pledges",
    "Assembling ministry delivery map",
    "Composing executive overture",
    "Drafting milestone ladder",
    "Weaving risks & measurement cadence",
    "Polishing prose",
  ];
  return (
    <div className="border border-line-200 bg-paper-0 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
        Generating
      </p>
      <ul className="mt-4 space-y-3">
        {stages.map((s) => (
          <li key={s} className="flex items-center gap-3 text-sm text-ink-700">
            <Loader2 size={12} className="animate-spin text-gold-500" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanCover({ plan }: { plan: TransformationalPlan }) {
  return (
    <div className="border border-line-200 bg-paper-0 p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
        Cabinet Report · {plan.metrics.horizon ?? ""}
      </p>
      <h1 className="mt-3 font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">
        {plan.title}
      </h1>
      {plan.subtitle && (
        <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed text-ink-700">
          {plan.subtitle}
        </p>
      )}
      {plan.metrics.gdp_delta_headline && (
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-gold-500">
          {plan.metrics.gdp_delta_headline}
        </p>
      )}
    </div>
  );
}

function MetricsStrip({ plan }: { plan: TransformationalPlan }) {
  const cells = [
    { label: "Pillars", value: plan.metrics.pillars },
    { label: "Pledges", value: plan.metrics.pledges },
    { label: "Deliverables", value: plan.metrics.deliverables },
    { label: "Ministries engaged", value: plan.metrics.ministries_engaged },
  ];
  return (
    <div className="grid grid-cols-2 border border-line-200 bg-paper-0 md:grid-cols-4">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            "p-5",
            i > 0 && "border-t border-line-200 md:border-l md:border-t-0",
            i === 2 && "border-t md:border-t-0",
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            {c.label}
          </p>
          <p className="mt-2 font-serif text-3xl tabular-nums text-ink-950">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PlanBody({ plan }: { plan: TransformationalPlan }) {
  const grouped = useMemo(() => {
    // Preserve author order but group same-kind adjacent sections visually.
    return plan.sections;
  }, [plan.sections]);
  return (
    <div className="space-y-10">
      {grouped.map((s, i) => (
        <SectionCard key={s.id} section={s} index={i + 1} />
      ))}
    </div>
  );
}

function SectionCard({ section, index }: { section: PlanSection; index: number }) {
  const meta = KIND_META[section.kind] ?? KIND_META.appendix;
  const Icon = meta.icon;
  return (
    <article
      id={section.id}
      className="border border-line-200 bg-paper-0 p-6 md:p-8"
    >
      <header className="flex items-start justify-between gap-4 border-b border-line-200 pb-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            <Icon size={11} />
            {section.eyebrow || meta.label}
          </p>
          <h3 className="mt-2 font-serif text-xl text-ink-950 md:text-2xl">
            {section.heading}
          </h3>
        </div>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-400">
          {String(index).padStart(2, "0")}
        </span>
      </header>
      <div className="prose prose-sm mt-5 max-w-none font-serif text-ink-800 [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-base [&_h3]:font-mono [&_h3]:text-[11px] [&_h3]:uppercase [&_h3]:tracking-[0.15em] [&_h3]:text-ink-500 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-medium [&_strong]:text-ink-950">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {section.body_md}
        </ReactMarkdown>
      </div>
    </article>
  );
}

function PlanActions({
  plan,
  onApprove,
  onPublish,
  onHandoff,
  approving,
  publishing,
  handingOff,
  countryCode,
}: {
  plan: TransformationalPlan;
  onApprove: () => void;
  onPublish: () => void;
  onHandoff: () => void;
  approving: boolean;
  publishing: boolean;
  handingOff: boolean;
  countryCode: string;
}) {
  const isApproved = plan.status === "approved" || plan.status === "published";
  const isPublished = plan.status === "published";
  const hasNarrative = !!plan.narrative_signal_id;

  return (
    <div className="border border-line-200 bg-paper-100/30 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
        Cabinet & narrative handoff
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onApprove}
          disabled={approving || isApproved}
          className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <ShieldCheck size={14} />
          {isApproved ? "Approved" : approving ? "Approving…" : "Approve for cabinet"}
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing || isPublished || !isApproved}
          className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Send size={14} />
          {isPublished ? "Published" : publishing ? "Publishing…" : "Publish"}
        </button>
        <button
          type="button"
          onClick={onHandoff}
          disabled={handingOff || hasNarrative}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowUpRight size={14} />
          {hasNarrative
            ? "Sent to Narrative"
            : handingOff
              ? "Handing off…"
              : "Send to Narrative Chamber"}
        </button>
        {hasNarrative && plan.narrative_signal_id && (
          <a
            href={`/narrative/signal/${plan.narrative_signal_id}?code=${countryCode}`}
            className="btn-ghost inline-flex items-center gap-2"
          >
            <ArrowUpRight size={14} /> Open signal
          </a>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        Handoff creates a first-class signal + strategy statement in Chamber 05
        so Comms can generate channel drafts (press release, PM statement,
        cabinet memo, op-ed lede) with citations intact.
      </p>
    </div>
  );
}
