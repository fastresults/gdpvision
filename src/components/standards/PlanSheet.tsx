import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { Explain } from "@/components/explain/Explain";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  deletePlan,
  getPlan,
  savePlan,
  transitionPlan,
  type Capabilities,
  type PlanHistoryItem,
} from "@/lib/standards/audit.functions";
import type { AuditRow } from "@/lib/standards/scoring";
import type { CollectionPlanRow } from "@/lib/syndication/db";
import { cn } from "@/lib/utils";

import {
  CADENCE_OPTIONS,
  FREQUENCY_LABEL,
  IMPACT_LABEL,
  METHOD_OPTIONS,
  MICRO,
  PLAN_META,
  SURVEY_METHOD,
  ageText,
  formatDate,
  formatDateTime,
  historyWords,
  isPastDue,
  rowCtx,
} from "./labels";
import { PlanMark, StatusMark } from "./StatusMark";

type Form = {
  owner: string;
  method: string;
  cadence: string;
  validation: string;
  due: string;
  notes: string;
};

function formFrom(plan: CollectionPlanRow | null, row: AuditRow): Form {
  const freq = (CADENCE_OPTIONS as readonly string[]).includes(row.frequency)
    ? row.frequency
    : "annual";
  if (!plan)
    return {
      owner: "",
      method: METHOD_OPTIONS[0],
      cadence: freq,
      validation: "",
      due: "",
      notes: "",
    };
  return {
    owner: plan.owner_agency ?? "",
    method: plan.method,
    cadence: plan.cadence,
    validation: plan.validation_rules ?? "",
    due: plan.due_date ?? "",
    notes: plan.notes ?? "",
  };
}

function Section({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-line-200 pt-4", className)}>
      <h3 className={MICRO}>{label}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function PlanSheet({
  code,
  row,
  capabilities,
  userId,
  onClose,
}: {
  code: string;
  row: AuditRow | null;
  capabilities: Capabilities;
  userId: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto rounded-none border-line-200 bg-paper-0 p-0 sm:max-w-xl"
      >
        {row && (
          <PlanSheetBody
            key={row.id}
            code={code}
            row={row}
            capabilities={capabilities}
            userId={userId}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PlanSheetBody({
  code,
  row,
  capabilities,
  userId,
}: {
  code: string;
  row: AuditRow;
  capabilities: Capabilities;
  userId: string;
}) {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getPlan);
  const save = useServerFn(savePlan);
  const transition = useServerFn(transitionPlan);
  const remove = useServerFn(deletePlan);

  const planKey = ["standards-plan", code, row.id] as const;
  const q = useQuery({
    queryKey: planKey,
    queryFn: () => fetchPlan({ data: { code, requirementId: row.id } }),
  });
  const plan = q.data?.plan ?? null;

  const [form, setForm] = useState<Form>(() => formFrom(null, row));
  const [revising, setRevising] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Load the form from the saved plan whenever the saved plan changes.
  const stamp = plan ? `${plan.id}:${plan.version}:${plan.updated_at}` : "none";
  useEffect(() => {
    if (q.isSuccess) setForm(formFrom(plan, row));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, q.isSuccess]);

  const status = plan?.status ?? null;
  const isSubmitter = !!plan?.submitted_by && plan.submitted_by === userId;
  const editable =
    status === null ||
    status === "draft" ||
    status === "returned" ||
    (status === "approved" && revising);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: planKey }),
      qc.invalidateQueries({ queryKey: ["standards-audit", code] }),
    ]);
  }

  async function run(label: string, fn: () => Promise<string | null>) {
    setBusy(label);
    setErr(null);
    setMsg(null);
    try {
      const m = await fn();
      await refresh();
      setMsg(m);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const onSave = (submit: boolean) =>
    run(submit ? "submit" : "save", async () => {
      const r = await save({
        data: {
          code,
          requirementId: row.id,
          owner: form.owner,
          method: form.method,
          cadence: form.cadence,
          validation: form.validation,
          due: form.due,
          notes: form.notes,
          submit,
        },
      });
      setRevising(false);
      if (r.reopened && r.status === "draft")
        return `Saved. The plan is back in draft as version ${r.version} and must be approved again.`;
      if (r.status === "submitted")
        return "Submitted for approval. A second person with approval rights must now review it.";
      if (r.status === "approved") return "No changes were made; the plan is still approved.";
      return "Saved as a draft.";
    });

  const onTransition = (to: "approved" | "returned" | "draft", label: string, done: string) =>
    run(label, async () => {
      if (!plan) return null;
      await transition({
        data: { code, planId: plan.id, to, note: to === "returned" ? returnNote : undefined },
      });
      setReturning(false);
      setReturnNote("");
      return done;
    });

  const onDelete = () =>
    run("delete", async () => {
      if (!plan) return null;
      await remove({ data: { code, planId: plan.id } });
      return "Draft deleted.";
    });

  const input =
    "mt-1 w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-sm text-ink-950 focus:border-ink-950 focus:outline-none disabled:bg-paper-50 disabled:text-ink-700";
  const set =
    (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pb-10 pt-6">
      <SheetHeader className="space-y-1 pr-6 text-left">
        <div className={MICRO}>
          {row.standardCode}
          {row.clause ? ` · ${row.clause}` : ""}
        </div>
        <SheetTitle className="font-display text-2xl font-normal leading-tight text-ink-950">
          {row.label}
        </SheetTitle>
        <SheetDescription className="text-sm text-ink-700">
          Required {(FREQUENCY_LABEL[row.frequency] ?? row.frequency).toLowerCase()}, within{" "}
          {row.maxLagMonths} months of the period closing · {IMPACT_LABEL[row.impact] ?? row.impact}{" "}
          impact
        </SheetDescription>
      </SheetHeader>

      <Section label="Why it has this status">
        <div className="mb-2">
          <Explain id="standards.status" ctx={rowCtx(row)} mark={false}>
            <StatusMark status={row.status} className="text-base" />
          </Explain>
        </div>
        <ul className="space-y-1 text-sm text-ink-700">
          {row.reasons.map((r, i) => (
            <li key={i} className="border-l-2 border-line-200 pl-3">
              {r}
            </li>
          ))}
        </ul>
        {row.status === "planned" && (
          <p className="mt-2 text-xs text-ink-500">
            <Explain id="standards.planned" ctx={rowCtx(row)}>
              Why an approved plan is not counted as collected
            </Explain>
          </p>
        )}
      </Section>

      <Section label="Evidence">
        {row.evidence.length === 0 ? (
          <p className="text-sm text-ink-500">
            No figure in the platform has a value for this requirement.
            {row.expectedKpis.length > 0 && <> Expected: {row.expectedKpis.join(", ")}.</>}
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {row.evidence.map((e) => (
              <li key={e.kpi} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs text-ink-950">{e.kpi}</span>
                {e.label && <span className="text-ink-700">{e.label}</span>}
                <span className="text-xs tabular-nums text-ink-500">
                  <Explain id="standards.freshness" ctx={rowCtx(row)} mark={false}>
                    {e.period ?? "undated"} ·{" "}
                    <span className={e.fresh ? "" : "text-signal-caution"}>
                      {ageText(e.ageMonths)}
                    </span>
                  </Explain>
                </span>
                {e.viaMapping && <span className="text-xs text-scenario-tint">via AI mapping</span>}
                {e.source && (
                  <a
                    href={e.source}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-ink-700 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                  >
                    Source ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="Collection plan">
        {q.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse bg-paper-50" />
            ))}
          </div>
        ) : q.error ? (
          <p className="border-l-2 border-signal-negative pl-3 text-sm text-signal-negative">
            {(q.error as Error).message}
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              {plan ? (
                <>
                  <PlanMark status={plan.status} />
                  <span className="text-xs text-ink-500">Version {plan.version}</span>
                  {plan.due_date && isPastDue(plan.due_date, row.status) && (
                    <span className="text-xs text-signal-negative">Past its due date</span>
                  )}
                </>
              ) : (
                <span className="text-ink-500">No plan yet. Draft one to close this gap.</span>
              )}
            </div>

            {plan?.status === "returned" && plan.returned_note && (
              <div className="mb-4 border border-signal-negative/40 border-l-2 border-l-signal-negative px-3 py-2">
                <div className={cn(MICRO, "text-signal-negative")}>Returned for changes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-950">
                  {plan.returned_note}
                </p>
              </div>
            )}

            {plan?.status === "approved" && !revising && (
              <p className="mb-3 border-l-2 border-signal-positive pl-3 text-xs text-ink-700">
                Approved{plan.approved_at ? ` on ${formatDate(plan.approved_at)}` : ""}. The plan is
                read-only. Revising it sends it back for approval.
              </p>
            )}
            {revising && (
              <p className="mb-3 border-l-2 border-gold-500 pl-3 text-xs text-ink-700">
                Editing an approved plan sends it back for approval. Saving a change makes it a
                draft (version {(plan?.version ?? 1) + 1}); it counts again only once a second
                person approves it.
              </p>
            )}
            {plan?.status === "submitted" && (
              <p className="mb-3 border-l-2 border-gold-500 pl-3 text-xs text-ink-700">
                Submitted{plan.submitted_at ? ` on ${formatDate(plan.submitted_at)}` : ""}
                {isSubmitter ? " by you" : ""}. The plan is read-only while it awaits approval.
              </p>
            )}

            <div className="space-y-3">
              <label className="block text-xs text-ink-700">
                Responsible ministry or agency
                <input
                  className={input}
                  value={form.owner}
                  onChange={set("owner")}
                  disabled={!editable}
                  placeholder="e.g. Central Statistical Office"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-ink-700">
                  Method
                  <select
                    className={input}
                    value={form.method}
                    onChange={set("method")}
                    disabled={!editable}
                  >
                    {!(METHOD_OPTIONS as readonly string[]).includes(form.method) && (
                      <option value={form.method}>{form.method}</option>
                    )}
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-ink-700">
                  Cadence
                  <select
                    className={input}
                    value={form.cadence}
                    onChange={set("cadence")}
                    disabled={!editable}
                  >
                    {!(CADENCE_OPTIONS as readonly string[]).includes(form.cadence) && (
                      <option value={form.cadence}>{form.cadence}</option>
                    )}
                    {CADENCE_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {FREQUENCY_LABEL[c]}
                        {c === row.frequency ? " (required)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {form.method === SURVEY_METHOD && (
                <Link
                  to="/admin/countries/$code/personas"
                  params={{ code }}
                  className="inline-block text-xs text-ink-950 underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
                >
                  Design the survey in Persona Lab →
                </Link>
              )}
              <label className="block text-xs text-ink-700">
                Validation rules
                <textarea
                  className={input}
                  rows={2}
                  value={form.validation}
                  onChange={set("validation")}
                  disabled={!editable}
                  placeholder="e.g. Completeness check, plausible range, revisions logged"
                />
              </label>
              <label className="block text-xs text-ink-700">
                Due date
                <input
                  type="date"
                  className={input}
                  value={form.due}
                  onChange={set("due")}
                  disabled={!editable}
                />
              </label>
              <label className="block text-xs text-ink-700">
                Notes
                <textarea
                  className={input}
                  rows={2}
                  value={form.notes}
                  onChange={set("notes")}
                  disabled={!editable}
                />
              </label>
            </div>

            {returning && (
              <label className="mt-4 block text-xs text-ink-700">
                What needs to change? (required)
                <textarea
                  className={input}
                  rows={3}
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  autoFocus
                  placeholder="Tell the submitter what to fix before this can be approved."
                />
              </label>
            )}

            {err && (
              <p className="mt-3 border-l-2 border-signal-negative pl-3 text-sm text-signal-negative">
                {err}
              </p>
            )}
            {msg && !err && (
              <p className="mt-3 border-l-2 border-signal-positive pl-3 text-sm text-ink-700">
                {msg}
              </p>
            )}

            <Actions
              status={status}
              revising={revising}
              returning={returning}
              isSubmitter={isSubmitter}
              canApprove={capabilities.approvePlans}
              busy={busy}
              returnNoteReady={returnNote.trim().length > 0}
              onSaveDraft={() => onSave(false)}
              onSubmit={() => onSave(true)}
              onDelete={onDelete}
              onWithdraw={() =>
                onTransition("draft", "withdraw", "Withdrawn. The plan is a draft again.")
              }
              onApprove={() => onTransition("approved", "approve", "Approved.")}
              onStartReturn={() => setReturning(true)}
              onCancelReturn={() => {
                setReturning(false);
                setReturnNote("");
              }}
              onReturn={() =>
                onTransition("returned", "return", "Returned to the submitter with your note.")
              }
              onRevise={() => setRevising(true)}
              onCancelRevise={() => {
                setRevising(false);
                setForm(formFrom(plan, row));
              }}
            />
          </>
        )}
      </Section>

      {plan && <History items={q.data?.history ?? []} />}
    </div>
  );
}

function Actions(p: {
  status: CollectionPlanRow["status"] | null;
  revising: boolean;
  returning: boolean;
  isSubmitter: boolean;
  canApprove: boolean;
  busy: string | null;
  returnNoteReady: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onWithdraw: () => void;
  onApprove: () => void;
  onStartReturn: () => void;
  onCancelReturn: () => void;
  onReturn: () => void;
  onRevise: () => void;
  onCancelRevise: () => void;
}) {
  const b = (key: string, label: string) =>
    p.busy === key ? (
      <>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {label}
      </>
    ) : (
      label
    );
  const dis = !!p.busy;
  const cls = "px-3 py-1.5 text-xs";
  let body: React.ReactNode = null;
  let note: string | null = null;

  if (
    p.status === null ||
    p.status === "draft" ||
    p.status === "returned" ||
    (p.status === "approved" && p.revising)
  ) {
    body = (
      <>
        {p.status === "draft" && (
          <button
            type="button"
            className={cn("btn-ghost mr-auto", cls)}
            disabled={dis}
            onClick={p.onDelete}
          >
            {b("delete", "Delete draft")}
          </button>
        )}
        {p.revising && (
          <button
            type="button"
            className={cn("btn-ghost mr-auto", cls)}
            disabled={dis}
            onClick={p.onCancelRevise}
          >
            Cancel revision
          </button>
        )}
        <button
          type="button"
          className={cn("btn-secondary", cls)}
          disabled={dis}
          onClick={p.onSaveDraft}
        >
          {b("save", "Save draft")}
        </button>
        <button
          type="button"
          className={cn("btn-primary", cls)}
          disabled={dis}
          onClick={p.onSubmit}
        >
          {b("submit", "Submit for approval")}
        </button>
      </>
    );
    note = "A second person with approval rights must approve the plan before it counts.";
  } else if (p.status === "submitted") {
    if (p.canApprove && !p.isSubmitter) {
      body = p.returning ? (
        <>
          <button
            type="button"
            className={cn("btn-ghost", cls)}
            disabled={dis}
            onClick={p.onCancelReturn}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn("btn-secondary", cls)}
            disabled={dis || !p.returnNoteReady}
            onClick={p.onReturn}
          >
            {b("return", "Return with note")}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={cn("btn-secondary", cls)}
            disabled={dis}
            onClick={p.onStartReturn}
          >
            Return with note
          </button>
          <button
            type="button"
            className={cn("btn-primary", cls)}
            disabled={dis}
            onClick={p.onApprove}
          >
            {b("approve", "Approve")}
          </button>
        </>
      );
    } else if (p.isSubmitter) {
      body = (
        <button
          type="button"
          className={cn("btn-secondary", cls)}
          disabled={dis}
          onClick={p.onWithdraw}
        >
          {b("withdraw", "Withdraw")}
        </button>
      );
      note = p.canApprove
        ? "You submitted this plan, so a different person with approval rights must approve it."
        : "Awaiting approval by a country admin, data steward or cabinet secretary.";
    } else {
      note = "Awaiting approval by a country admin, data steward or cabinet secretary.";
    }
  } else if (p.status === "approved") {
    body = (
      <button
        type="button"
        className={cn("btn-secondary", cls)}
        disabled={dis}
        onClick={p.onRevise}
      >
        Revise
      </button>
    );
  }

  return (
    <div className="mt-5">
      {body && <div className="flex flex-wrap items-center justify-end gap-2">{body}</div>}
      {note && <p className="mt-2 text-right text-xs text-ink-500">{note}</p>}
    </div>
  );
}

function History({ items }: { items: PlanHistoryItem[] }) {
  return (
    <Section label="History">
      {items.length === 0 ? (
        <p className="text-sm text-ink-500">No recorded changes yet.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((h) => {
            const to = h.to as keyof typeof PLAN_META | null;
            const tone = to && PLAN_META[to] ? PLAN_META[to].border : "border-line-200";
            return (
              <li key={h.id} className={cn("border-l-2 pl-3", tone)}>
                <div className="text-sm text-ink-950">{historyWords(h.action, h.version)}</div>
                <div className="text-xs text-ink-500">
                  {h.actorLabel ?? (h.actorId ? "A team member" : "System")} ·{" "}
                  {formatDateTime(h.at)}
                  {h.version ? ` · version ${h.version}` : ""}
                </div>
                {h.note && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-ink-700">“{h.note}”</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
