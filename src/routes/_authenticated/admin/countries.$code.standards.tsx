import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { Explain } from "@/components/explain/Explain";
import { getStandardsAudit, saveProtocol, type AuditRow } from "@/lib/standards/audit.functions";
import "@/lib/explain/standards-entries";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/standards")({
  head: ({ params }) => ({
    meta: [
      { title: `Standards audit · ${params.code} — GDPVision` },
      { name: "description", content: `Reporting-standards coverage, data gaps and governed collection protocols for ${params.code}.` },
      { property: "og:title", content: `Standards audit · ${params.code}` },
      { property: "og:description", content: `Reporting-standards coverage and collection protocols for ${params.code}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StandardsPage,
});

const STATUS_CLS: Record<string, string> = {
  collected: "text-signal-positive",
  partial: "text-gold-500",
  stale: "text-gold-500",
  missing: "text-signal-negative",
};
const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function StandardsPage() {
  const { code } = Route.useParams();
  const fetchAudit = useServerFn(getStandardsAudit);
  const q = useQuery({ queryKey: ["standards-audit", code], queryFn: () => fetchAudit({ data: { code } }) });
  const [editing, setEditing] = useState<AuditRow | null>(null);
  const [filter, setFilter] = useState<string>("gaps");

  const rows = (q.data?.rows ?? [])
    .filter((r) => (filter === "gaps" ? r.status !== "collected" : filter === "all" ? true : r.standardCode === filter))
    .sort((a, b) => (IMPACT_RANK[a.impact] ?? 3) - (IMPACT_RANK[b.impact] ?? 3));

  return (
    <SuperAdminShell
      wide
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Standards audit" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-950">Data standards audit</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            What is collected, what is missing, and the governed protocol that closes each gap.
          </p>
        </div>
        <Link to="/admin/countries/$code/investments" params={{ code }} className="btn-secondary px-3 py-2 text-xs">
          Investment pipeline
        </Link>
      </div>

      {q.isLoading && <p className="text-sm text-ink-500">Auditing…</p>}
      {q.error && <p className="text-sm text-signal-negative">{(q.error as Error).message}</p>}

      {q.data && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {q.data.standards.map((s) => {
              const pct = s.total ? Math.round((s.met / s.total) * 100) : 0;
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setFilter(s.code)}
                  className={filter === s.code ? "card-choice card-choice-active text-left" : "card-choice text-left"}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{s.body}</div>
                  <div className="mt-1 text-sm text-ink-950">{s.name}</div>
                  <div className="mt-2 h-1.5 w-full bg-line-100">
                    <div className="h-full bg-gold-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-xs tabular-nums text-ink-700">
                    <Explain id="standards.coverage">{s.met}/{s.total} met · {pct}%</Explain>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex gap-2">
            {["gaps", "all"].map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={filter === f ? "btn-primary px-3 py-1 text-xs" : "btn-ghost px-3 py-1 text-xs"}>
                {f === "gaps" ? "Gap register" : "All requirements"}
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead className="border-b border-line-200 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="py-2">Requirement</th>
                <th>Standard</th>
                <th>Frequency</th>
                <th>Impact</th>
                <th>Status</th>
                <th>Evidence</th>
                <th>Protocol</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line-100 align-top">
                  <td className="py-2 pr-3 text-ink-950">
                    {r.label}
                    {r.clause && <div className="text-xs text-ink-500">{r.clause}</div>}
                  </td>
                  <td className="pr-3 font-mono text-xs">{r.standardCode}</td>
                  <td className="pr-3">{r.frequency}</td>
                  <td className="pr-3">{r.impact}</td>
                  <td className={`pr-3 font-medium ${STATUS_CLS[r.status]}`}>
                    <Explain id="standards.coverage">{r.status}</Explain>
                  </td>
                  <td className="pr-3 text-xs text-ink-700">
                    {r.evidence.length === 0
                      ? "—"
                      : r.evidence.map((e) => (
                          <div key={e.kpi}>
                            {e.kpi} · {e.period ?? "n/a"}
                          </div>
                        ))}
                  </td>
                  <td>
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(r)}>
                      {r.protocol ? `${r.protocol.status}` : "Create"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {editing && <ProtocolDialog code={code} row={editing} onClose={() => setEditing(null)} />}
    </SuperAdminShell>
  );
}

function ProtocolDialog({ code, row, onClose }: { code: string; row: AuditRow; onClose: () => void }) {
  const save = useServerFn(saveProtocol);
  const qc = useQueryClient();
  const [owner, setOwner] = useState(row.protocol?.owner ?? "");
  const [method, setMethod] = useState("administrative records");
  const [cadence, setCadence] = useState(row.frequency);
  const [validation, setValidation] = useState("Completeness, plausibility range, revision log");
  const [due, setDue] = useState(row.protocol?.due ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "save" | "submit" | "approve") {
    setBusy(true);
    setErr(null);
    try {
      await save({ data: { code, requirementId: row.id, owner, method, cadence, validation, due: due || undefined, action } });
      await qc.invalidateQueries({ queryKey: ["standards-audit", code] });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-sm";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-paper-0 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-ink-950">Collection protocol</h2>
        <p className="mb-4 text-sm text-ink-700">
          {row.standardCode} · {row.label}
        </p>
        <div className="space-y-3">
          <label className="block text-xs text-ink-700">
            Responsible ministry / agency
            <input className={input} value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label className="block text-xs text-ink-700">
            Method
            <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>administrative records</option>
              <option>survey (Persona Lab fieldwork)</option>
              <option>API / automated feed</option>
              <option>manual upload</option>
            </select>
          </label>
          <label className="block text-xs text-ink-700">
            Cadence
            <input className={input} value={cadence} onChange={(e) => setCadence(e.target.value)} />
          </label>
          <label className="block text-xs text-ink-700">
            Validation rules
            <textarea className={input} rows={2} value={validation} onChange={(e) => setValidation(e.target.value)} />
          </label>
          <label className="block text-xs text-ink-700">
            Due date
            <input type="date" className={input} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <p className="mt-3 text-xs text-ink-500">Four-eyes rule: the approver must be a different person from the submitter.</p>
        {err && <p className="mt-2 text-sm text-signal-negative">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={onClose}>Cancel</button>
          <button type="button" disabled={busy} className="btn-secondary px-3 py-1.5 text-xs" onClick={() => run("save")}>Save draft</button>
          <button type="button" disabled={busy} className="btn-secondary px-3 py-1.5 text-xs" onClick={() => run("submit")}>Submit</button>
          <button type="button" disabled={busy || row.protocol?.status !== "submitted"} className="btn-primary px-3 py-1.5 text-xs" onClick={() => run("approve")}>Approve</button>
        </div>
      </div>
    </div>
  );
}
