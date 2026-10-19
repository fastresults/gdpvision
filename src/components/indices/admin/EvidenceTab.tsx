// Evidence: documentary and external-assessment values, entered with their
// source document and verified by a second person before they can feed a run.
// The database enforces the two-person rule; this page explains it.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { saveIndexEvidence, verifyIndexEvidence } from "@/lib/indices/indices.functions";
import {
  listIndexEvidence,
  type EvidenceRow,
  type IndicesOverview,
} from "@/lib/indices/review.functions";
import { Empty, Eyebrow, INDEX_CODES, Section, Tag, fieldCls, type IndexCode } from "./shared";

type State = "unverified" | "verified" | "all";

export function EvidenceTab({ o }: { o: IndicesOverview }) {
  const list = useServerFn(listIndexEvidence);
  const [state, setState] = useState<State>("unverified");
  const [index, setIndex] = useState<IndexCode | "">("");
  const [country, setCountry] = useState("");
  const [editing, setEditing] = useState<Partial<FormState> | null>(null);

  const q = useQuery({
    queryKey: ["index-evidence", state, index, country],
    queryFn: () =>
      list({
        data: { state, indexCode: index || undefined, country: country || undefined, limit: 500 },
      }),
  });
  const allQ = useQuery({
    queryKey: ["index-evidence", "all", "", ""],
    queryFn: () => list({ data: { state: "all", limit: 500 } }),
  });

  const evidenceInds = o.indicators.filter((i) => i.source_kind === "evidence");
  const names = useMemo(() => new Map(o.countries.map((c) => [c.code, c.name])), [o.countries]);
  const indMeta = useMemo(
    () => new Map(evidenceInds.map((i) => [`${i.index_code}.${i.code}`, i])),
    [evidenceInds],
  );

  return (
    <>
      <Section title="Coverage to collect">
        <p className="mb-3 max-w-3xl text-sm text-ink-500">
          Governance (CGV) and Capital (CCX) score only once their documentary indicators have
          verified evidence. Each row shows how many of the {o.countries.length} states have a
          verified value.
        </p>
        <Coverage
          o={o}
          rows={allQ.data ?? []}
          onAdd={(index_code, indicator_code) => setEditing({ index_code, indicator_code })}
        />
      </Section>

      <Section
        title="Evidence"
        aside={
          <button type="button" className="btn-primary" onClick={() => setEditing({})}>
            Add evidence
          </button>
        }
      >
        {editing && <EvidenceForm o={o} initial={editing} onDone={() => setEditing(null)} />}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["unverified", `To verify (${o.evidence.unverified})`],
              ["verified", `Verified (${o.evidence.verified})`],
              ["all", "All"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={state === k ? "btn-primary" : "btn-secondary"}
              onClick={() => setState(k)}
            >
              {label}
            </button>
          ))}
          <select
            className="border border-line-200 bg-paper-0 px-2 py-1 text-sm"
            value={index}
            onChange={(e) => setIndex(e.target.value as IndexCode | "")}
          >
            <option value="">All indexes</option>
            {INDEX_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="border border-line-200 bg-paper-0 px-2 py-1 text-sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">All states</option>
            {o.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          {q.isLoading && <Empty>Loading…</Empty>}
          {q.error && <p className="text-sm text-red-700">{(q.error as Error).message}</p>}
          {q.data?.length === 0 && (
            <Empty>
              {state === "unverified"
                ? "Nothing waiting for verification."
                : "No evidence matches."}
            </Empty>
          )}
          {q.data?.map((r) => (
            <EvidenceCard
              key={r.id}
              r={r}
              name={names.get(r.country_code) ?? r.country_code}
              meta={indMeta.get(`${r.index_code}.${r.indicator_code}`)}
              onEdit={() =>
                setEditing({
                  index_code: r.index_code as IndexCode,
                  indicator_code: r.indicator_code,
                  country: r.country_code,
                  value: String(r.value),
                  period: r.period,
                  documentTitle: r.document_title,
                  documentUrl: r.document_url,
                  documentDate: r.document_date ?? "",
                  publisher: r.publisher,
                  grade: r.grade,
                  notes: r.notes ?? "",
                })
              }
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function Coverage({
  o,
  rows,
  onAdd,
}: {
  o: IndicesOverview;
  rows: EvidenceRow[];
  onAdd: (index: IndexCode, indicator: string) => void;
}) {
  const inds = o.indicators.filter((i) => i.source_kind === "evidence" && i.status === "active");
  if (!inds.length) return <Empty>No active evidence indicators.</Empty>;
  const count = (i: (typeof inds)[number], verified: boolean) =>
    new Set(
      rows
        .filter(
          (r) =>
            r.index_code === i.index_code && r.indicator_code === i.code && r.verified === verified,
        )
        .map((r) => r.country_code),
    ).size;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-numeric>
        <thead>
          <tr className="border-b border-line-200 text-left text-xs uppercase tracking-widest text-ink-500">
            <th className="py-2 font-normal">Index</th>
            <th className="py-2 font-normal">Indicator</th>
            <th className="py-2 font-normal">Where to find it</th>
            <th className="py-2 text-right font-normal">Verified</th>
            <th className="py-2 text-right font-normal">To verify</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {inds.map((i) => {
            const v = count(i, true);
            const u = count(i, false);
            return (
              <tr key={`${i.index_code}.${i.code}`} className="border-b border-line-200/60">
                <td className="py-1.5 font-mono text-xs">{i.index_code}</td>
                <td className="py-1.5">
                  {i.name} <span className="text-xs text-ink-500">({i.unit || "value"})</span>
                </td>
                <td className="py-1.5 text-xs text-ink-700">
                  {i.source_url ? (
                    <a href={i.source_url} target="_blank" rel="noreferrer" className="underline">
                      {i.source_org}
                    </a>
                  ) : (
                    i.source_org
                  )}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {v}/{o.countries.length}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">{u || "—"}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onAdd(i.index_code as IndexCode, i.code)}
                  >
                    Add →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceCard({
  r,
  name,
  meta,
  onEdit,
}: {
  r: EvidenceRow;
  name: string;
  meta?: IndicesOverview["indicators"][number];
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const verify = useServerFn(verifyIndexEvidence);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await verify({ data: { id: r.id } });
      toast.success("Verified — it will feed the next run");
      await qc.invalidateQueries({ queryKey: ["index-evidence"] });
      await qc.invalidateQueries({ queryKey: ["indices-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink-950">
          {meta?.name ?? r.indicator_code} · <span className="text-ink-700">{name}</span>
        </p>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            {r.index_code} · {r.period} · grade {r.grade}
          </span>
          <Tag tone={r.verified ? "good" : "warn"}>{r.verified ? "verified" : "to verify"}</Tag>
        </span>
      </div>
      <p className="mt-2 font-serif text-xl tabular-nums">
        {r.value} <span className="text-sm text-ink-500">{meta?.unit}</span>
      </p>
      <p className="mt-1 text-xs text-ink-700">
        <a href={r.document_url} target="_blank" rel="noreferrer" className="underline">
          {r.document_title}
        </a>{" "}
        — {r.publisher}
        {r.document_date ? `, ${r.document_date}` : ""}
      </p>
      {r.notes && <p className="mt-1 text-xs text-ink-500">{r.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!r.verified && (
          <button
            type="button"
            className="btn-primary"
            disabled={busy || r.entered_by_me}
            title={r.entered_by_me ? "You entered this; a second person must verify it" : undefined}
            onClick={go}
          >
            Verify against the document
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onEdit}>
          Correct
        </button>
        {!r.verified && r.entered_by_me && (
          <span className="text-xs text-ink-500">
            You entered this — a second person verifies it.
          </span>
        )}
        {r.verified && (
          <span className="text-xs text-ink-500">
            Correcting a verified value sends it back for verification.
          </span>
        )}
      </div>
    </div>
  );
}

interface FormState {
  index_code: IndexCode;
  indicator_code: string;
  country: string;
  value: string;
  period: string;
  documentTitle: string;
  documentUrl: string;
  documentDate: string;
  publisher: string;
  grade: "A" | "B" | "C" | "D";
  notes: string;
}

const GRADE_HELP: Record<FormState["grade"], string> = {
  A: "A · government source, current year",
  B: "B · government source, prior year or partial",
  C: "C · multilateral or international body",
  D: "D · analyst reconstruction",
};

function EvidenceForm({
  o,
  initial,
  onDone,
}: {
  o: IndicesOverview;
  initial: Partial<FormState>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveIndexEvidence);
  const lastYear = String(new Date().getUTCFullYear() - 1);
  const [f, setF] = useState<FormState>({
    index_code: initial.index_code ?? "CGV",
    indicator_code: initial.indicator_code ?? "",
    country: initial.country ?? "",
    value: initial.value ?? "",
    period: initial.period ?? lastYear,
    documentTitle: initial.documentTitle ?? "",
    documentUrl: initial.documentUrl ?? "",
    documentDate: initial.documentDate ?? "",
    publisher: initial.publisher ?? "",
    grade: initial.grade ?? "A",
    notes: initial.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const inds = o.indicators.filter(
    (i) => i.index_code === f.index_code && i.source_kind === "evidence" && i.status === "active",
  );
  const ind = inds.find((i) => i.code === f.indicator_code);
  const valueNum = Number(f.value);
  const outside =
    ind && f.value !== "" && Number.isFinite(valueNum)
      ? valueNum < Math.min(ind.goal_best, ind.goal_worst) ||
        valueNum > Math.max(ind.goal_best, ind.goal_worst)
      : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ind) return toast.error("Choose an indicator");
    if (!f.country) return toast.error("Choose a state");
    if (!Number.isFinite(valueNum) || f.value === "") return toast.error("Enter a number");
    setBusy(true);
    try {
      await save({
        data: {
          indexCode: f.index_code,
          indicatorCode: f.indicator_code,
          country: f.country,
          value: valueNum,
          period: f.period,
          documentTitle: f.documentTitle,
          documentUrl: f.documentUrl,
          documentDate: f.documentDate || undefined,
          publisher: f.publisher,
          grade: f.grade,
          notes: f.notes || undefined,
        },
      });
      toast.success("Saved. A second person now verifies it against the document.");
      await qc.invalidateQueries({ queryKey: ["index-evidence"] });
      await qc.invalidateQueries({ queryKey: ["indices-overview"] });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 border border-ink-950 p-4">
      <div className="flex items-baseline justify-between">
        <Eyebrow>{initial.country ? "Correct evidence" : "New evidence"}</Eyebrow>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel ✕
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <L label="Index">
          <select
            className={fieldCls}
            value={f.index_code}
            onChange={(e) =>
              setF((p) => ({ ...p, index_code: e.target.value as IndexCode, indicator_code: "" }))
            }
          >
            {INDEX_CODES.map((c) => (
              <option key={c} value={c}>
                {c} · {o.specs.find((s) => s.code === c)?.name ?? c}
              </option>
            ))}
          </select>
        </L>
        <L label="Indicator">
          <select
            className={fieldCls}
            value={f.indicator_code}
            onChange={(e) => {
              const next = inds.find((i) => i.code === e.target.value);
              setF((p) => ({
                ...p,
                indicator_code: e.target.value,
                publisher: p.publisher || next?.source_org || "",
              }));
            }}
          >
            <option value="">Choose…</option>
            {inds.map((i) => (
              <option key={i.code} value={i.code}>
                {i.name}
              </option>
            ))}
          </select>
        </L>
        <L label="State">
          <select
            className={fieldCls}
            value={f.country}
            onChange={(e) => set("country", e.target.value)}
          >
            <option value="">Choose…</option>
            {o.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </L>
        {ind && (
          <p className="text-xs text-ink-500 md:col-span-3">
            Unit: {ind.unit || "value"} · scored from {ind.goal_worst} (worst) to {ind.goal_best}{" "}
            (best) · values older than {ind.age_tolerance_years} years are excluded · find it at{" "}
            {ind.source_url ? (
              <a className="underline" href={ind.source_url} target="_blank" rel="noreferrer">
                {ind.source_org}
              </a>
            ) : (
              ind.source_org
            )}
            {ind.notes ? ` · ${ind.notes}` : ""}
          </p>
        )}
        <L label={`Value${ind?.unit ? ` (${ind.unit})` : ""}`}>
          <input
            className={fieldCls}
            inputMode="decimal"
            value={f.value}
            onChange={(e) => set("value", e.target.value)}
          />
          {outside && (
            <span className="text-xs text-amber-800">
              Outside the goalposts — it will be clipped. Check the unit.
            </span>
          )}
        </L>
        <L label="Year the fact refers to">
          <input
            className={fieldCls}
            value={f.period}
            pattern="\d{4}"
            onChange={(e) => set("period", e.target.value)}
          />
        </L>
        <L label="Grade">
          <select
            className={fieldCls}
            value={f.grade}
            onChange={(e) => set("grade", e.target.value as FormState["grade"])}
          >
            {(Object.keys(GRADE_HELP) as FormState["grade"][]).map((g) => (
              <option key={g} value={g}>
                {GRADE_HELP[g]}
              </option>
            ))}
          </select>
        </L>
        <L label="Document title" wide>
          <input
            className={fieldCls}
            value={f.documentTitle}
            onChange={(e) => set("documentTitle", e.target.value)}
            required
            minLength={3}
          />
        </L>
        <L label="Document date">
          <input
            className={fieldCls}
            type="date"
            value={f.documentDate}
            onChange={(e) => set("documentDate", e.target.value)}
          />
        </L>
        <L label="Document link (https)" wide>
          <input
            className={fieldCls}
            type="url"
            pattern="https://.*"
            value={f.documentUrl}
            onChange={(e) => set("documentUrl", e.target.value)}
            required
          />
        </L>
        <L label="Publisher">
          <input
            className={fieldCls}
            value={f.publisher}
            onChange={(e) => set("publisher", e.target.value)}
            required
            minLength={2}
          />
        </L>
        <L label="Notes (page, table, how the value was read)" wide>
          <input
            className={fieldCls}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </L>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save for verification"}
        </button>
        <span className="text-xs text-ink-500">
          Nothing is scored until a second person verifies it against the document.
        </span>
      </div>
    </form>
  );
}

function L({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "md:col-span-2" : ""}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">{label}</span>
      {children}
    </label>
  );
}
